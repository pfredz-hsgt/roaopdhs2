import React, { useState, useEffect } from 'react';
import { Typography, Table, Button, message, InputNumber, Card, Space, Tag, Modal, Spin, Grid, List } from 'antd';
import { SendOutlined, ExclamationCircleOutlined, UnorderedListOutlined, TableOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { confirm } = Modal;
const { useBreakpoint } = Grid;

const RoutineSummaryPage = () => {
    const screens = useBreakpoint();
    const isDesktop = screens.lg;
    const { user, profile } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [sessionData, setSessionData] = useState(null);
    const [indentItems, setIndentItems] = useState([]);
    const [viewMode, setViewMode] = useState(isDesktop ? 'table' : 'list');

    useEffect(() => {
        setViewMode(isDesktop ? 'table' : 'list');
    }, [isDesktop]);

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
                message.info({ content: "You don't have any active indent drafts at the moment.", key: 'no-drafts' });
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
            title: 'Requested Qty',
            key: 'qty',
            width: 150,
            render: (_, record) => (
                <Space>
                    <Text strong>{record.requested_qty}</Text>
                    {record.requested_qty > 0 && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
                </Space>
            )
        }
    ];

    const handleResume = () => {
        if (!sessionData?.rak) {
            navigate(-1);
            return;
        }

        const firstZeroItem = indentItems.find(item => item.requested_qty === 0 || !item.requested_qty);
        let url = `/routine-indent?rak=${sessionData.rak}`;
        if (firstZeroItem) {
            url += `&resumeItemId=${firstZeroItem.item_id}`;
        }

        navigate(url);
    };

    if (loading) {
        return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>;
    }

    const renderListItem = (record) => (
        <List.Item>
            <Card size="small" style={{ width: '100%', borderColor: record.requested_qty > 0 ? '#00df43ff' : undefined }}>
                <div style={{ marginBottom: '8px' }}>
                    <Text strong>{record.inventory_items?.name}</Text>
                    {record.inventory_items?.pku && (
                        <Tag color="orange" style={{ marginLeft: 8 }}>{record.inventory_items.pku}</Tag>
                    )}
                </div>
                <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
                    <Text type="secondary">Max: <Text strong>{record.inventory_items?.max_qty ?? 0}</Text></Text>
                    <Text type="secondary">Bal: <Text strong>{record.inventory_items?.balance ?? 0}</Text></Text>
                </div>
                {record.indent_remarks && (
                    <div style={{ marginBottom: '8px' }}>
                        <Text type="secondary" italic>{record.indent_remarks}</Text>
                    </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px' }}>
                    <Text strong>Requested Qty:</Text>
                    <Space>
                        <Text strong style={{ fontSize: '16px' }}>{record.requested_qty}</Text>
                        {record.requested_qty > 0 && <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '16px' }} />}
                    </Space>
                </div>
            </Card>
        </List.Item>
    );

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
                <div>
                    <Title level={3} style={{ margin: 0 }}>Indent Summary</Title>
                    <Text type="secondary">Created by: {profile?.name} at {dayjs(sessionData?.created_at).format('DD/MM/YYYY HH:mm:ss')}</Text>
                </div>
                <Space wrap>
                    {sessionData?.rak && (
                        <Tag color="blue" style={{ fontSize: '16px', padding: '4px 12px' }}>Rak: {sessionData.rak}</Tag>
                    )}
                    <Space>
                        <Button
                            type={viewMode === 'list' ? 'primary' : 'default'}
                            icon={<UnorderedListOutlined />}
                            onClick={() => setViewMode('list')}
                        />
                        <Button
                            type={viewMode === 'table' ? 'primary' : 'default'}
                            icon={<TableOutlined />}
                            onClick={() => setViewMode('table')}
                        />
                    </Space>
                </Space>
            </div>

            <Card style={{ marginBottom: 24 }} bodyStyle={{ padding: viewMode === 'table' ? 0 : 16 }}>
                {viewMode === 'table' ? (
                    <Table
                        columns={columns}
                        dataSource={indentItems}
                        rowKey="id"
                        pagination={false}
                        scroll={{ y: 500 }}
                    />
                ) : (
                    <List
                        grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 2, xl: 3, xxl: 3 }}
                        dataSource={indentItems}
                        renderItem={renderListItem}
                        pagination={false}
                    />
                )}
            </Card>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Button onClick={handleResume}>
                    Resume Indent
                </Button>

                <Button
                    type="primary"
                    size="medium"
                    icon={<SendOutlined />}
                    onClick={handleSend}
                    loading={submitting}
                >
                    Confirm & Send
                </Button>
            </div>
        </div>
    );
}

export default RoutineSummaryPage;
