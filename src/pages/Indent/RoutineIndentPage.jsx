import React, { useState, useEffect, useRef } from 'react';
import { Typography, Card, Button, InputNumber, Input, Row, Col, Spin, message, DatePicker, Checkbox, Steps, Space } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { supabase } from '../../lib/supabase';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

const RoutineIndentPage = () => {
    const { user } = useAuth();
    const [items, setItems] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [sessionId, setSessionId] = useState(null);

    // Store user inputs for the current item
    const [currentMaxQty, setCurrentMaxQty] = useState(0);
    const [currentQty, setCurrentQty] = useState(0);
    const [currentBalance, setCurrentBalance] = useState(null);
    const [currentRemarks, setCurrentRemarks] = useState('');
    const [enableShortExp, setEnableShortExp] = useState(false);

    // Short Expiry Details
    const [shortExp1, setShortExp1] = useState({ batch: '', date: null, qty: null });
    const [shortExp2, setShortExp2] = useState({ batch: '', date: null, qty: null });

    const location = useLocation();
    const navigate = useNavigate();
    const searchParams = new URLSearchParams(location.search);
    const rak = searchParams.get('rak');
    const resumeItemId = searchParams.get('resumeItemId');
    const initRakRef = useRef(null);

    useEffect(() => {
        if (!rak) {
            navigate('/home');
            return;
        }
        if (initRakRef.current !== rak) {
            initRakRef.current = rak;
            initSession();
        }
    }, [rak]);

    const initSession = async () => {
        setLoading(true);
        try {
            // 1. Find or create a Draft session for this user
            let { data: sessionData, error: sessionError } = await supabase
                .from('indent_sessions')
                .select('*')
                .eq('user_id', user.id)
                .eq('status', 'Draft')
                .eq('session_type', 'Routine')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (sessionError) throw sessionError;

            let currentSessionId = sessionData?.id;

            if (!sessionData) {
                const { data: newSession, error: createError } = await supabase
                    .from('indent_sessions')
                    .insert([{
                        user_id: user.id,
                        session_type: 'Routine',
                        status: 'Draft',
                        rak: rak
                    }])
                    .select()
                    .single();

                if (createError) throw createError;
                currentSessionId = newSession.id;
            } else {
                // If resuming a draft, check if it's the same rak. If not, we should probably warn or reset, 
                // but for simplicity, we update the rak.
                await supabase.from('indent_sessions').update({ rak: rak }).eq('id', currentSessionId);
            }

            setSessionId(currentSessionId);

            // 2. Fetch inventory items for this rak
            const { data: invItems, error: invError } = await supabase
                .from('inventory_items')
                .select('*')
                .eq('indent_source', 'OPD Substor')
                .eq('row', rak)
                .order('name');

            if (invError) throw invError;

            if (!invItems || invItems.length === 0) {
                message.warning({ content: `No items found in Rak ${rak}`, key: 'no-items' });
                navigate('/home');
                return;
            }

            setItems(invItems);

            // 3. Load draft data for the specified or first item
            let startIndex = 0;
            if (resumeItemId) {
                const foundIndex = invItems.findIndex(i => i.id === resumeItemId);
                if (foundIndex !== -1) {
                    startIndex = foundIndex;
                }
            }
            setCurrentIndex(startIndex);
            await loadItemData(invItems[startIndex].id, currentSessionId, invItems);

        } catch (error) {
            console.error(error);
            message.error("Failed to initialize routine session.");
        } finally {
            setLoading(false);
        }
    };

    const loadItemData = async (itemId, sid = sessionId, sourceItems = items) => {
        const { data, error } = await supabase
            .from('indent_items')
            .select('*')
            .eq('session_id', sid)
            .eq('item_id', itemId)
            .single();

        const invItem = sourceItems.find(i => i.id === itemId);
        const maxQty = invItem?.max_qty || 0;
        const balance = invItem?.balance || 0;
        const defaultQty = Math.max(0, maxQty - balance);

        if (data) {

            setCurrentRemarks(data.indent_remarks || '');
            setCurrentMaxQty(maxQty);
            setCurrentBalance(balance);
            setCurrentQty(data.requested_qty || defaultQty);

            const hasShortExp = data.batch_no_1 || data.batch_no_2;
            setEnableShortExp(!!hasShortExp);

            setShortExp1({
                batch: data.batch_no_1 || '',
                date: data.exp_date_1 ? dayjs(data.exp_date_1) : null,
                qty: data.short_qty_1 || null
            });
            setShortExp2({
                batch: data.batch_no_2 || '',
                date: data.exp_date_2 ? dayjs(data.exp_date_2) : null,
                qty: data.short_qty_2 || null
            });
        } else {
            // Reset to defaults
            setCurrentMaxQty(maxQty);
            setCurrentQty(defaultQty);
            setCurrentBalance(balance);
            setCurrentRemarks('');
            setEnableShortExp(false);
            setShortExp1({ batch: '', date: null, qty: null });
            setShortExp2({ batch: '', date: null, qty: null });
        }
    };

    const saveCurrentData = async () => {
        if (!items[currentIndex]) return true;

        setSaving(true);
        try {
            const currentItem = items[currentIndex];

            // Upsert the data
            const upsertData = {
                session_id: sessionId,
                item_id: currentItem.id,
                requested_qty: currentQty,
                indent_remarks: currentRemarks,
                snapshot_max_qty: currentMaxQty,
                snapshot_balance: currentBalance,
            };

            if (enableShortExp) {
                upsertData.batch_no_1 = shortExp1.batch || null;
                upsertData.exp_date_1 = shortExp1.date ? shortExp1.date.format('YYYY-MM-DD') : null;
                upsertData.short_qty_1 = shortExp1.qty || 0;

                upsertData.batch_no_2 = shortExp2.batch || null;
                upsertData.exp_date_2 = shortExp2.date ? shortExp2.date.format('YYYY-MM-DD') : null;
                upsertData.short_qty_2 = shortExp2.qty || 0;
            } else {
                // Clear short exp data if unchecked
                upsertData.batch_no_1 = null;
                upsertData.exp_date_1 = null;
                upsertData.short_qty_1 = 0;
                upsertData.batch_no_2 = null;
                upsertData.exp_date_2 = null;
                upsertData.short_qty_2 = 0;
            }

            // check if row already exists
            const { data: existing } = await supabase
                .from('indent_items')
                .select('id')
                .eq('session_id', sessionId)
                .eq('item_id', currentItem.id)
                .single();

            if (currentQty > 0) {
                if (existing) {
                    await supabase.from('indent_items').update(upsertData).eq('id', existing.id);
                } else {
                    await supabase.from('indent_items').insert([upsertData]);
                }
            } else if (existing) {
                // If quantity is 0, remove it from the draft session
                await supabase.from('indent_items').delete().eq('id', existing.id);
            }

            // Save max_qty and balance if they were adjusted
            const inventoryUpdates = {};
            if (currentMaxQty !== currentItem.max_qty) {
                inventoryUpdates.max_qty = currentMaxQty;
            }
            if (currentBalance !== currentItem.balance) {
                inventoryUpdates.balance = currentBalance;
            }

            if (Object.keys(inventoryUpdates).length > 0) {
                await supabase.from('inventory_items').update(inventoryUpdates).eq('id', currentItem.id);
                // Update local items array so we don't think it changed next time
                setItems(prevItems => prevItems.map(item => item.id === currentItem.id ? { ...item, ...inventoryUpdates } : item));
            }

            return true;
        } catch (error) {
            console.error(error);
            message.error("Failed to save item data.");
            return false;
        } finally {
            setSaving(false);
        }
    };

    const handleNext = async () => {
        const success = await saveCurrentData();
        if (success) {
            if (currentIndex < items.length - 1) {
                const nextIndex = currentIndex + 1;
                setCurrentIndex(nextIndex);
                await loadItemData(items[nextIndex].id, sessionId);
            } else {
                // Done! Navigate to summary
                navigate('/routine-summary');
            }
        }
    };

    const handlePrevious = async () => {
        const success = await saveCurrentData();
        if (success && currentIndex > 0) {
            const prevIndex = currentIndex - 1;
            setCurrentIndex(prevIndex);
            await loadItemData(items[prevIndex].id, sessionId);
        }
    };

    if (loading) {
        return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" tip="Loading Routine..." /></div>;
    }

    if (items.length === 0) return null;

    const currentItem = items[currentIndex];

    // Calculate progress percentage
    const progressPercent = Math.round(((currentIndex + 1) / items.length) * 100);

    return (
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                    <Title level={4} style={{ margin: 0 }}>Routine Indent for Rak: {rak}</Title>
                    <Text type="secondary">Item {currentIndex + 1} of {items.length}</Text>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <Text strong style={{ color: '#1890ff', fontSize: '18px' }}>{progressPercent}%</Text>
                </div>
            </div>

            <div style={{ height: 6, background: '#f0f0f0', borderRadius: 4, marginBottom: 24, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: '#1890ff', width: `${progressPercent}%`, transition: 'width 0.3s' }} />
            </div>

            <Card
                title={
                    <div>
                        <div style={{ fontSize: '20px', whiteSpace: 'normal', lineHeight: '1.4', paddingTop: '10px' }}>{currentItem.name}</div>
                        {currentItem.pku && (
                            <div style={{
                                display: 'inline-block',
                                background: '#ffe58f',
                                color: '#d46b08',
                                padding: '4px 12px',
                                borderRadius: 16,
                                fontWeight: 'bold',
                                border: '1px solid #ffd591',
                                marginTop: '10px',
                                fontSize: '14px',
                                marginBottom: '10px'
                            }}>
                                PKU: {currentItem.pku}
                            </div>
                        )}
                    </div>
                }
                bodyStyle={{ padding: 24 }}
            >
                <Row gutter={[24, 24]}>
                    <Col xs={24} sm={12}>
                        <div style={{ marginBottom: 24, padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
                            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                                <div style={{ flex: 1 }}>
                                    <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>Max Qty</Text>
                                    <InputNumber
                                        size="large"
                                        min={0}
                                        value={currentMaxQty}
                                        inputMode="numeric"
                                        onChange={(val) => {
                                            setCurrentMaxQty(val);
                                            if (currentBalance !== null && val !== null) {
                                                setCurrentQty(Math.max(0, val - currentBalance));
                                            }
                                        }}
                                        style={{ width: '100%' }}
                                        readOnly
                                    />
                                </div>

                                <div style={{ flex: 1 }}>
                                    <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>Balance</Text>
                                    <InputNumber
                                        size="large"
                                        min={0}
                                        placeholder="Balance"
                                        value={currentBalance}
                                        inputMode="numeric"
                                        onChange={(val) => {
                                            setCurrentBalance(val);
                                            const max = currentMaxQty || 0;
                                            if (val !== null) {
                                                const calcQty = Math.max(0, max - val);
                                                setCurrentQty(calcQty);
                                            }
                                        }}
                                        style={{ width: '100%' }}
                                    />
                                </div>
                            </div>

                            <hr style={{ border: 0, borderTop: '1px dashed #d9d9d9', margin: '16px 0' }} />

                            <div style={{}}>
                                <Text strong style={{ display: 'block', marginBottom: 8 }}>Indent Qty</Text>
                                <InputNumber
                                    size="large"
                                    min={0}
                                    value={currentQty}
                                    inputMode="numeric"
                                    onChange={setCurrentQty}
                                    style={{ width: '100%' }}
                                />
                            </div>
                        </div>

                        <div>
                            <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>Remarks (for Issuer)</Text>
                            <TextArea
                                rows={3}
                                placeholder="Enter any specific notes..."
                                value={currentRemarks}
                                onChange={(e) => setCurrentRemarks(e.target.value)}
                            />
                        </div>
                    </Col>

                    <Col xs={24} sm={12}>
                        <Card size="small" style={{ background: '#fafafa' }}>
                            <Checkbox
                                checked={enableShortExp}
                                onChange={(e) => setEnableShortExp(e.target.checked)}
                                style={{ marginBottom: 16, fontWeight: 500 }}
                            >
                                Has Short Expiry?
                            </Checkbox>

                            {enableShortExp && (
                                <div style={{ marginTop: 16 }}>
                                    <div style={{ marginBottom: 16, padding: '12px', background: '#fff', border: '1px solid #e8e8e8', borderRadius: 4 }}>
                                        <Text strong style={{ display: 'block', marginBottom: 8 }}>Batch 1</Text>
                                        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                                            <Input
                                                placeholder="Batch No"
                                                value={shortExp1.batch}
                                                onChange={e => setShortExp1({ ...shortExp1, batch: e.target.value })}
                                            />
                                            <InputNumber
                                                placeholder="Qty"
                                                min={0}
                                                value={shortExp1.qty}
                                                inputMode="numeric"
                                                onChange={v => setShortExp1({ ...shortExp1, qty: v })}
                                            />
                                        </div>
                                        <DatePicker
                                            placeholder="Expiry Date"
                                            style={{ width: '100%' }}
                                            value={shortExp1.date}
                                            onChange={d => setShortExp1({ ...shortExp1, date: d })}
                                        />
                                    </div>

                                    <div style={{ padding: '12px', background: '#fff', border: '1px solid #e8e8e8', borderRadius: 4 }}>
                                        <Text strong style={{ display: 'block', marginBottom: 8 }}>Batch 2</Text>
                                        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                                            <Input
                                                placeholder="Batch No"
                                                value={shortExp2.batch}
                                                onChange={e => setShortExp2({ ...shortExp2, batch: e.target.value })}
                                            />
                                            <InputNumber
                                                placeholder="Qty"
                                                min={0}
                                                value={shortExp2.qty}
                                                inputMode="numeric"
                                                onChange={v => setShortExp2({ ...shortExp2, qty: v })}
                                            />
                                        </div>
                                        <DatePicker
                                            placeholder="Expiry Date"
                                            style={{ width: '100%' }}
                                            value={shortExp2.date}
                                            onChange={d => setShortExp2({ ...shortExp2, date: d })}
                                        />
                                    </div>
                                </div>
                            )}
                        </Card>
                    </Col>
                </Row>
            </Card>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, padding: '0 16px' }}>
                <Button
                    size="large"
                    icon={<LeftOutlined />}
                    disabled={currentIndex === 0}
                    onClick={handlePrevious}
                    loading={saving}
                >
                    Previous
                </Button>

                <Button
                    type="primary"
                    size="large"
                    onClick={handleNext}
                    loading={saving}
                >
                    {currentIndex === items.length - 1 ? 'Finish & Review Summary' : 'Next Item'} <RightOutlined />
                </Button>
            </div>
        </div>
    );
};

export default RoutineIndentPage;
