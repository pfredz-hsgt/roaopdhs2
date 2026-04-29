import React, { useState, useEffect, useRef } from 'react';
import { Typography, Card, Button, InputNumber, Input, Row, Col, Spin, message, DatePicker, Select, Space, Modal, List, Tag, Tabs } from 'antd';
import { LeftOutlined, RightOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

const ShortExpEntry = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    // Setup state
    const [raks, setRaks] = useState([]);
    const [loadingRaks, setLoadingRaks] = useState(true);
    const [selectedRak, setSelectedRak] = useState(null);
    const [isStarted, setIsStarted] = useState(false);

    // Iteration state
    const [items, setItems] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Current item data
    const [existingRecordId, setExistingRecordId] = useState(null);
    const [shortExp1, setShortExp1] = useState({ batch: '', date: null, qty: null });
    const [shortExp2, setShortExp2] = useState({ batch: '', date: null, qty: null });

    // Search and Modal state
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [modalExp1, setModalExp1] = useState({ batch: '', date: null, qty: null });
    const [modalExp2, setModalExp2] = useState({ batch: '', date: null, qty: null });
    const [modalExistingRecordId, setModalExistingRecordId] = useState(null);
    const [modalSaving, setModalSaving] = useState(false);

    // Debounce search term
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Search effect
    useEffect(() => {
        const search = async () => {
            if (!debouncedSearchTerm) {
                setSearchResults([]);
                return;
            }
            setIsSearching(true);
            try {
                const { data, error } = await supabase
                    .from('inventory_items')
                    .select('*')
                    .ilike('name', `%${debouncedSearchTerm}%`)
                    .order('name')
                    .limit(20);

                if (error) throw error;
                setSearchResults(data);
            } catch (err) {
                console.error(err);
                message.error("Search failed");
            } finally {
                setIsSearching(false);
            }
        };
        search();
    }, [debouncedSearchTerm]);

    const openItemModal = async (item) => {
        setSelectedItem(item);
        setIsModalOpen(true);
        // Fetch existing short exp record for this item
        let { data, error } = await supabase
            .from('indent_items')
            .select('*')
            .eq('item_id', item.id)
            .or('batch_no_1.not.is.null,batch_no_2.not.is.null')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (data) {
            setModalExistingRecordId(data.id);
            setModalExp1({
                batch: data.batch_no_1 || '',
                date: data.exp_date_1 ? dayjs(data.exp_date_1) : null,
                qty: data.short_qty_1 || null
            });
            setModalExp2({
                batch: data.batch_no_2 || '',
                date: data.exp_date_2 ? dayjs(data.exp_date_2) : null,
                qty: data.short_qty_2 || null
            });
        } else {
            setModalExistingRecordId(null);
            setModalExp1({ batch: '', date: null, qty: null });
            setModalExp2({ batch: '', date: null, qty: null });
        }
    };

    const handleModalSave = async () => {
        setModalSaving(true);
        try {
            const hasData = modalExp1.batch || modalExp2.batch;

            if (!hasData && !modalExistingRecordId) {
                setIsModalOpen(false);
                return;
            }

            const upsertData = {
                batch_no_1: modalExp1.batch || null,
                exp_date_1: modalExp1.date ? modalExp1.date.format('YYYY-MM-DD') : null,
                short_qty_1: modalExp1.qty || null,
                batch_no_2: modalExp2.batch || null,
                exp_date_2: modalExp2.date ? modalExp2.date.format('YYYY-MM-DD') : null,
                short_qty_2: modalExp2.qty || null,
            };

            if (modalExistingRecordId) {
                await supabase.from('indent_items').update(upsertData).eq('id', modalExistingRecordId);
            } else {
                if (hasData) {
                    upsertData.session_id = null;
                    upsertData.item_id = selectedItem.id;
                    upsertData.requested_qty = 0;
                    upsertData.snapshot_max_qty = selectedItem.max_qty || 0;
                    upsertData.snapshot_balance = selectedItem.balance || 0;
                    await supabase.from('indent_items').insert([upsertData]);
                }
            }
            message.success('Short expiry details saved');
            setIsModalOpen(false);
        } catch (err) {
            console.error(err);
            message.error('Failed to save item data');
        } finally {
            setModalSaving(false);
        }
    };

    useEffect(() => {
        const fetchRaks = async () => {
            setLoadingRaks(true);
            try {
                const { data, error } = await supabase
                    .from('inventory_items')
                    .select('row')
                    .not('row', 'is', null);

                if (error) throw error;

                const uniqueRaks = [...new Set(data.map(item => item.row))].filter(Boolean).sort();
                setRaks(uniqueRaks);
            } catch (err) {
                console.error("Error fetching raks", err);
                message.error("Failed to load Raks");
            } finally {
                setLoadingRaks(false);
            }
        };

        fetchRaks();
    }, []);

    const initSessionAndItems = async (rak) => {
        setLoading(true);
        try {
            // Fetch ALL inventory items for this rak
            const { data: invItems, error: invError } = await supabase
                .from('inventory_items')
                .select('*')
                .eq('row', rak)
                .order('name');

            if (invError) throw invError;

            if (!invItems || invItems.length === 0) {
                message.warning(`No items found in Rak ${rak}`);
                return false;
            }

            setItems(invItems);
            setCurrentIndex(0);
            await loadItemData(invItems[0].id);
            return true;
        } catch (error) {
            console.error(error);
            message.error("Failed to initialize items.");
            return false;
        } finally {
            setLoading(false);
        }
    };

    const handleStart = async () => {
        if (!selectedRak) {
            message.warning("Please select a Rak first!");
            return;
        }
        const success = await initSessionAndItems(selectedRak);
        if (success) {
            setIsStarted(true);
        }
    };

    const loadItemData = async (itemId) => {
        // Find existing short exp record across ANY session first
        let { data, error } = await supabase
            .from('indent_items')
            .select('*')
            .eq('item_id', itemId)
            .or('batch_no_1.not.is.null,batch_no_2.not.is.null')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (data) {
            setExistingRecordId(data.id);
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
            setExistingRecordId(null);
            setShortExp1({ batch: '', date: null, qty: null });
            setShortExp2({ batch: '', date: null, qty: null });
        }
    };

    const saveCurrentData = async () => {
        if (!items[currentIndex]) return true;

        setSaving(true);
        try {
            const currentItem = items[currentIndex];

            const hasData = shortExp1.batch || shortExp2.batch;

            if (!hasData && !existingRecordId) {
                // Nothing to save, no existing record
                return true;
            }

            const upsertData = {
                batch_no_1: shortExp1.batch || null,
                exp_date_1: shortExp1.date ? shortExp1.date.format('YYYY-MM-DD') : null,
                short_qty_1: shortExp1.qty || null,
                batch_no_2: shortExp2.batch || null,
                exp_date_2: shortExp2.date ? shortExp2.date.format('YYYY-MM-DD') : null,
                short_qty_2: shortExp2.qty || null,
            };

            if (existingRecordId) {
                // If it exists but they cleared it, still update it so it gets removed from ShortExpPage
                await supabase.from('indent_items').update(upsertData).eq('id', existingRecordId);
            } else {
                // Only insert if there is data
                if (hasData) {
                    upsertData.session_id = null;
                    upsertData.item_id = currentItem.id;
                    upsertData.requested_qty = 0; // default for ShortExp only entry
                    upsertData.snapshot_max_qty = currentItem.max_qty || 0;
                    upsertData.snapshot_balance = currentItem.balance || 0;
                    await supabase.from('indent_items').insert([upsertData]);
                }
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
                await loadItemData(items[nextIndex].id);
            } else {
                // Done! Navigate back
                message.success("Completed Rak!");
                navigate('/shortexp');
            }
        }
    };

    const handlePrevious = async () => {
        const success = await saveCurrentData();
        if (success && currentIndex > 0) {
            const prevIndex = currentIndex - 1;
            setCurrentIndex(prevIndex);
            await loadItemData(items[prevIndex].id);
        }
    };

    if (!isStarted) {
        return (
            <div style={{ maxWidth: 500, margin: '40px auto', textAlign: 'center' }}>
                <Title level={3}>Record Short Expiry</Title>
                <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
                    Select a Rak to iterate through all its items and record short expiry dates.
                </Text>

                <Card>
                    {loadingRaks ? <Spin /> : (
                        <Space direction="vertical" style={{ width: '100%' }} size="large">
                            <Select
                                style={{ width: '100%' }}
                                size="large"
                                placeholder="Select a Rak"
                                value={selectedRak}
                                onChange={setSelectedRak}
                            >
                                {raks.map(r => (
                                    <Option key={r} value={r}>{r}</Option>
                                ))}
                            </Select>
                            <Button type="primary" size="large" block onClick={handleStart}>
                                Start Recording
                            </Button>
                        </Space>
                    )}
                </Card>

                <Card title="Search & Edit Specific Drug" style={{ marginTop: 24, textAlign: 'left' }}>
                    <Input.Search
                        placeholder="Search drug name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        loading={isSearching}
                        size="large"
                        allowClear
                    />
                    {searchResults.length > 0 && (
                        <List
                            size="small"
                            style={{ marginTop: 16, maxHeight: 300, overflow: 'auto' }}
                            bordered
                            dataSource={searchResults}
                            renderItem={(item) => (
                                <List.Item
                                    onClick={() => openItemModal(item)}
                                    style={{ cursor: 'pointer', transition: 'background-color 0.3s' }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                    <List.Item.Meta
                                        title={item.name}
                                        description={item.row ? `Rak: ${item.row}` : null}
                                    />
                                </List.Item>
                            )}
                        />
                    )}
                </Card>

                <Modal
                    title={`Edit Short Expiry`}
                    open={isModalOpen}
                    onCancel={() => setIsModalOpen(false)}
                    onOk={handleModalSave}
                    confirmLoading={modalSaving}
                    width={500}
                    destroyOnClose
                >
                    {/* Drug Info */}
                    {selectedItem && (
                        <div style={{ textAlign: 'center', marginTop: 16 }}>
                            <Title level={4} style={{ marginBottom: 4 }}>
                                {selectedItem.name}
                            </Title>

                            {/* Item Code and PKU */}
                            <Space size="large" style={{ marginBottom: 12 }}>
                                {selectedItem.pku && (
                                    <Text type="secondary" style={{ fontSize: '13px' }}>
                                        PKU: <Text strong>{selectedItem.pku}</Text>
                                    </Text>
                                )}
                            </Space> <br />

                            {/* Tags */}
                            <Space wrap style={{ marginBottom: 8, justifyContent: 'center' }}>
                                {selectedItem.row && <Tag color="blue">Rak: {selectedItem.row}</Tag>}
                                {selectedItem.puchase_type && <Tag color="orange">{selectedItem.puchase_type}</Tag>}
                                {selectedItem.indent_source && <Tag color="green">{selectedItem.indent_source}</Tag>}
                                {selectedItem.std_kt && <Tag color="purple">{selectedItem.std_kt}</Tag>}
                            </Space>
                        </div>
                    )}

                    <div style={{ background: '#fafafa', padding: 16, borderRadius: 8, marginTop: 16 }}>
                        <Tabs
                            defaultActiveKey="1"
                            type="card"
                            items={[
                                {
                                    key: '1',
                                    label: 'Batch 1',
                                    children: (
                                        <div style={{ padding: '16px', background: '#fff', border: '1px solid #e8e8e8', borderRadius: 8 }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                                <div>
                                                    <Text type="secondary" style={{ fontSize: '12px', marginBottom: '4px', display: 'block' }}>Batch Number</Text>
                                                    <Input
                                                        placeholder="Batch No"
                                                        value={modalExp1.batch}
                                                        onChange={e => setModalExp1({ ...modalExp1, batch: e.target.value })}
                                                    />
                                                </div>
                                                <div>
                                                    <Text type="secondary" style={{ fontSize: '12px', marginBottom: '4px', display: 'block' }}>Quantity</Text>
                                                    <InputNumber
                                                        placeholder="Qty"
                                                        min={0}
                                                        value={modalExp1.qty}
                                                        inputMode="numeric"
                                                        onChange={v => setModalExp1({ ...modalExp1, qty: v })}
                                                        style={{ width: '100%' }}
                                                    />
                                                </div>
                                                <div>
                                                    <Text type="secondary" style={{ fontSize: '12px', marginBottom: '4px', display: 'block' }}>Expiry Date</Text>
                                                    <DatePicker
                                                        placeholder="Expiry Date"
                                                        style={{ width: '100%' }}
                                                        value={modalExp1.date}
                                                        onChange={d => setModalExp1({ ...modalExp1, date: d })}
                                                        format="DD/MM/YYYY"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )
                                },
                                {
                                    key: '2',
                                    label: 'Batch 2',
                                    children: (
                                        <div style={{ padding: '16px', background: '#fff', border: '1px solid #e8e8e8', borderRadius: 8 }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                                <div>
                                                    <Text type="secondary" style={{ fontSize: '12px', marginBottom: '4px', display: 'block' }}>Batch Number</Text>
                                                    <Input
                                                        placeholder="Batch No"
                                                        value={modalExp2.batch}
                                                        onChange={e => setModalExp2({ ...modalExp2, batch: e.target.value })}
                                                    />
                                                </div>
                                                <div>
                                                    <Text type="secondary" style={{ fontSize: '12px', marginBottom: '4px', display: 'block' }}>Quantity</Text>
                                                    <InputNumber
                                                        placeholder="Qty"
                                                        min={0}
                                                        value={modalExp2.qty}
                                                        inputMode="numeric"
                                                        onChange={v => setModalExp2({ ...modalExp2, qty: v })}
                                                        style={{ width: '100%' }}
                                                    />
                                                </div>
                                                <div>
                                                    <Text type="secondary" style={{ fontSize: '12px', marginBottom: '4px', display: 'block' }}>Expiry Date</Text>
                                                    <DatePicker
                                                        placeholder="Expiry Date"
                                                        style={{ width: '100%' }}
                                                        value={modalExp2.date}
                                                        onChange={d => setModalExp2({ ...modalExp2, date: d })}
                                                        format="DD/MM/YYYY"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )
                                }
                            ]}
                        />
                    </div>
                </Modal>
            </div>
        );
    }

    if (loading) {
        return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" tip="Loading Items..." /></div>;
    }

    if (items.length === 0) return null;

    const currentItem = items[currentIndex];
    const progressPercent = Math.round(((currentIndex + 1) / items.length) * 100);

    return (
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                    <Title level={4} style={{ margin: 0 }}>Record Short Expiry for Rak: {selectedRak}</Title>
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
                <div style={{ background: '#fafafa', padding: 16, borderRadius: 8 }}>
                    <Title level={5} style={{ marginBottom: 16 }}>Short Expiry Details</Title>

                    <Tabs
                        defaultActiveKey="1"
                        type="card"
                        items={[
                            {
                                key: '1',
                                label: 'Batch 1',
                                children: (
                                    <div style={{ padding: '16px', background: '#fff', border: '1px solid #e8e8e8', borderRadius: 8 }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                            <div>
                                                <Text type="secondary" style={{ fontSize: '12px', marginBottom: '4px', display: 'block' }}>Batch Number</Text>
                                                <Input
                                                    placeholder="Batch No"
                                                    value={shortExp1.batch}
                                                    onChange={e => setShortExp1({ ...shortExp1, batch: e.target.value })}
                                                />
                                            </div>
                                            <div>
                                                <Text type="secondary" style={{ fontSize: '12px', marginBottom: '4px', display: 'block' }}>Quantity</Text>
                                                <InputNumber
                                                    placeholder="Qty"
                                                    min={0}
                                                    value={shortExp1.qty}
                                                    inputMode="numeric"
                                                    onChange={v => setShortExp1({ ...shortExp1, qty: v })}
                                                    style={{ width: '100%' }}
                                                />
                                            </div>
                                            <div>
                                                <Text type="secondary" style={{ fontSize: '12px', marginBottom: '4px', display: 'block' }}>Expiry Date</Text>
                                                <DatePicker
                                                    placeholder="Expiry Date"
                                                    style={{ width: '100%' }}
                                                    value={shortExp1.date}
                                                    onChange={d => setShortExp1({ ...shortExp1, date: d })}
                                                    format="DD/MM/YYYY"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )
                            },
                            {
                                key: '2',
                                label: 'Batch 2',
                                children: (
                                    <div style={{ padding: '16px', background: '#fff', border: '1px solid #e8e8e8', borderRadius: 8 }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                            <div>
                                                <Text type="secondary" style={{ fontSize: '12px', marginBottom: '4px', display: 'block' }}>Batch Number</Text>
                                                <Input
                                                    placeholder="Batch No"
                                                    value={shortExp2.batch}
                                                    onChange={e => setShortExp2({ ...shortExp2, batch: e.target.value })}
                                                />
                                            </div>
                                            <div>
                                                <Text type="secondary" style={{ fontSize: '12px', marginBottom: '4px', display: 'block' }}>Quantity</Text>
                                                <InputNumber
                                                    placeholder="Qty"
                                                    min={0}
                                                    value={shortExp2.qty}
                                                    inputMode="numeric"
                                                    onChange={v => setShortExp2({ ...shortExp2, qty: v })}
                                                    style={{ width: '100%' }}
                                                />
                                            </div>
                                            <div>
                                                <Text type="secondary" style={{ fontSize: '12px', marginBottom: '4px', display: 'block' }}>Expiry Date</Text>
                                                <DatePicker
                                                    placeholder="Expiry Date"
                                                    style={{ width: '100%' }}
                                                    value={shortExp2.date}
                                                    onChange={d => setShortExp2({ ...shortExp2, date: d })}
                                                    format="DD/MM/YYYY"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )
                            }
                        ]}
                    />
                </div>
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
                    {currentIndex === items.length - 1 ? 'Finish & Return' : 'Next Item'} {currentIndex === items.length - 1 ? <CheckCircleOutlined /> : <RightOutlined />}
                </Button>
            </div>
        </div>
    );
};

export default ShortExpEntry;
