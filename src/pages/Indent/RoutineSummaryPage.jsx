import React, { useState, useEffect } from 'react';
import { Typography, Table, Button, message, InputNumber, Card, Space, Tag, Modal, Spin } from 'antd';
import { SendOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { confirm } = Modal;

const RoutineSummaryPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [sessionData, setSessionData] = useState(null);
    const [indentItems, setIndentItems] = useState([]);

    useEffect(() => {
        fetchSummaryData();
    }, []);

    const fetchSummaryData = async () => {
        setLoading(true);
        try {
            // Fetch current Draft session
            const { data: session, error: sessionError } = await supabase
                .from('indent_sessions')
                .select('*')
                .eq('user_id', user.id)
                .eq('status', 'Draft')
                .in('session_type', ['Routine', 'Urgent'])
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (sessionError) throw sessionError;

            if (!session) {
                message.info("You don't have any active indent drafts at the moment.");
                navigate('/home');
                return;
            }

            setSessionData(session);

            // Fetch items
            const { data: items, error: itemsError } = await supabase
                .from('indent_items')
                .select('*, inventory_items(*)')
                .eq('session_id', session.id)
                .order('created_at', { ascending: true });

            if (itemsError) throw itemsError;

            let finalItems = items || [];

            // Fetch missing inventory items to show items with 0 qty
            if (session.rak) {
                const { data: invItems, error: invError } = await supabase
                    .from('inventory_items')
                    .select('*')
                    .eq('indent_source', 'OPD Substor')
                    .eq('row', session.rak)
                    .order('name');

                if (!invError && invItems) {
                    const existingItemIds = new Set(finalItems.map(item => item.item_id));
                    const missingItems = invItems
                        .filter(invItem => !existingItemIds.has(invItem.id))
                        .map(invItem => ({
                            id: `mock-${invItem.id}`,
                            session_id: session.id,
                            item_id: invItem.id,
                            requested_qty: 0,
                            inventory_items: invItem,
                            is_mock: true
                        }));

                    finalItems = [...finalItems, ...missingItems];
                    finalItems.sort((a, b) => a.inventory_items?.name?.localeCompare(b.inventory_items?.name));
                }
            }

            setIndentItems(finalItems);

        } catch (error) {
            console.error("Error fetching summary data:", error);
            message.error("Failed to load summary.");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateQty = async (itemId, newQty, record) => {
        try {
            const finalQty = newQty || 0;
            if (record.is_mock) {
                if (finalQty === 0) return; // Still 0, do nothing

                // Insert new indent_item
                const upsertData = {
                    session_id: record.session_id,
                    item_id: record.item_id,
                    requested_qty: finalQty,
                    snapshot_max_qty: record.inventory_items?.max_qty || 0,
                    snapshot_balance: record.inventory_items?.balance || 0,
                };

                const { data, error } = await supabase
                    .from('indent_items')
                    .insert([upsertData])
                    .select()
                    .single();

                if (error) throw error;

                // Update local state and remove mock flag
                setIndentItems(prevItems =>
                    prevItems.map(item =>
                        item.id === itemId ? { ...item, ...data, is_mock: false } : item
                    )
                );
            } else {
                if (finalQty === 0) {
                    // Delete from DB if 0
                    const { error } = await supabase
                        .from('indent_items')
                        .delete()
                        .eq('id', itemId);

                    if (error) throw error;

                    // Revert to mock
                    setIndentItems(prevItems =>
                        prevItems.map(item =>
                            item.id === itemId ? {
                                ...item,
                                id: `mock-${item.item_id}`,
                                requested_qty: 0,
                                is_mock: true
                            } : item
                        )
                    );
                } else {
                    const { error } = await supabase
                        .from('indent_items')
                        .update({ requested_qty: finalQty })
                        .eq('id', itemId);

                    if (error) throw error;

                    setIndentItems(prevItems =>
                        prevItems.map(item =>
                            item.id === itemId ? { ...item, requested_qty: finalQty } : item
                        )
                    );
                }
            }
        } catch (error) {
            console.error(error);
            message.error("Failed to update quantity");
        }
    };

    const handleSend = () => {

        confirm({
            title: 'Send this indent to Substore?',
            icon: <ExclamationCircleOutlined />,
            content: 'Once sent you wont be able to edit anymore.',
            onOk() {
                submitIndent();
            },
        });
    };

    const submitIndent = async () => {
        setSubmitting(true);
        try {
            const mockItemsToInsert = indentItems
                .filter(item => item.is_mock)
                .map(item => ({
                    session_id: item.session_id,
                    item_id: item.item_id,
                    requested_qty: 0,
                    snapshot_max_qty: item.inventory_items?.max_qty || 0,
                    snapshot_balance: item.inventory_items?.balance || 0,
                }));

            if (mockItemsToInsert.length > 0) {
                const { error: insertError } = await supabase
                    .from('indent_items')
                    .insert(mockItemsToInsert);

                if (insertError) throw insertError;
            }

            const { error } = await supabase
                .from('indent_sessions')
                .update({ status: 'Submitted' })
                .eq('id', sessionData.id);

            if (error) throw error;

            message.success({ content: "Indent submitted successfully to Issuer!", duration: 5 });
            navigate('/home');
        } catch (error) {
            message.error("Failed to submit indent.");
            console.error(error);
            setSubmitting(false);
        }
    };

    const columns = [
        {
            title: 'Item Name',
            dataIndex: ['inventory_items', 'name'],
            key: 'name',
            render: (text, record) => (
                <div>
                    <Text strong>{text}</Text>
                    {record.inventory_items?.pku && (
                        <Tag color="orange" style={{ marginLeft: 8 }}>{record.inventory_items.pku}</Tag>
                    )}
                </div>
            )
        },
        {
            title: 'Max Qty',
            key: 'max_qty',
            width: 90,
            align: 'center',
            render: (_, record) => <Text>{record.inventory_items?.max_qty ?? 0}</Text>
        },
        {
            title: 'Balance',
            key: 'balance',
            width: 90,
            align: 'center',
            render: (_, record) => <Text>{record.inventory_items?.balance ?? 0}</Text>
        },
        {
            title: 'Remarks',
            dataIndex: 'indent_remarks',
            key: 'remarks',
            render: (text) => text || <Text type="secondary" italic>No remarks</Text>
        },
        {
            title: 'Short Expiry Details',
            key: 'shortExp',
            render: (_, record) => {
                if (!record.batch_no_1 && !record.batch_no_2) return "-";
                return (
                    <div style={{ fontSize: '12px' }}>
                        {record.batch_no_1 && (
                            <div>
                                <Tag color="volcano">{record.batch_no_1}</Tag>
                                {dayjs(record.exp_date_1).format('DD/MM/YYYY')} (Qty: {record.short_qty_1})
                            </div>
                        )}
                        {record.batch_no_2 && (
                            <div style={{ marginTop: 4 }}>
                                <Tag color="volcano">{record.batch_no_2}</Tag>
                                {dayjs(record.exp_date_2).format('DD/MM/YYYY')} (Qty: {record.short_qty_2})
                            </div>
                        )}
                    </div>
                );
            }
        },
        {
            title: 'Requested Qty',
            key: 'qty',
            width: 150,
            render: (_, record) => (
                <InputNumber
                    min={0}
                    value={record.requested_qty}
                    onChange={(val) => handleUpdateQty(record.id, val, record)}
                />
            )
        }
    ];

    if (loading) {
        return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>;
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <Title level={3} style={{ margin: 0 }}>Indent Summary</Title>
                    <Text type="secondary">Review your draft before sending.</Text>
                </div>
                {sessionData?.rak && (
                    <Tag color="blue" style={{ fontSize: '16px', padding: '4px 12px' }}>Rak: {sessionData.rak}</Tag>
                )}
            </div>

            <Card style={{ marginBottom: 24 }} bodyStyle={{ padding: 0 }}>
                <Table
                    columns={columns}
                    dataSource={indentItems}
                    rowKey="id"
                    pagination={false}
                    scroll={{ y: 500 }}
                />
            </Card>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Button onClick={() => sessionData?.rak ? navigate(`/routine-indent?rak=${sessionData.rak}`) : navigate(-1)}>
                    Resume Indenting
                </Button>

                <Button
                    type="primary"
                    size="large"
                    icon={<SendOutlined />}
                    onClick={handleSend}
                    loading={submitting}
                    style={{ minWidth: 200, height: 50, fontSize: '18px' }}
                >
                    SEND INDENT
                </Button>
            </div>
        </div>
    );
}

export default RoutineSummaryPage;
