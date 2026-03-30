import React, { useState, useEffect, useMemo } from 'react';
import { Table, Typography, Card, Spin, message, DatePicker, Select, Form, Space, Input, List, Tag } from 'antd';
import { supabase } from '../../lib/supabase';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';

dayjs.extend(isBetween);

const { Title } = Typography;
const { RangePicker } = DatePicker;

const IndentRecordPage = () => {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState([]);

    // Filters
    const [dateRange, setDateRange] = useState(null);
    const [selectedUser, setSelectedUser] = useState(null);
    const [searchText, setSearchText] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [expandedRowKeys, setExpandedRowKeys] = useState([]);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchText);
        }, 300);
        return () => clearTimeout(handler);
    }, [searchText]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch users for filter
            const { data: usersData } = await supabase.from('profiles').select('id, name');
            if (usersData) setUsers(usersData);

            // Fetch COMPLETED or SUBMITTED sessions (Historical)
            const { data: sessionData, error: sessionError } = await supabase
                .from('indent_sessions')
                .select(`
                    id, 
                    created_at, 
                    status, 
                    session_type, 
                    rak,
                    profiles(name),
                    indent_items(inventory_items(name))
                `)
                .in('status', ['Submitted', 'Approved', 'Completed'])
                .order('created_at', { ascending: false });

            if (sessionError) throw sessionError;

            // Fetch Approved or Completed urgent indents
            const { data: requestsData, error: requestsError } = await supabase
                .from('indent_requests')
                .select(`
                    id,
                    created_at,
                    requested_qty,
                    status,
                    snapshot_max_qty,
                    snapshot_balance,
                    indent_remarks,
                    inventory_items(name),
                    profiles(name)
                `)
                .in('status', ['Approved', 'Completed'])
                .order('created_at', { ascending: false });

            if (requestsError) throw requestsError;

            let processedSessions = sessionData || [];

            if (requestsData && requestsData.length > 0) {
                // Group requests by user and date (YYYY-MM-DD)
                const groupedRequests = requestsData.reduce((acc, req) => {
                    const profileName = req.profiles?.name || 'Unknown Indenter';
                    const dateKey = dayjs(req.created_at).format('YYYY-MM-DD');
                    const key = `${profileName}-${dateKey}`;
                    if (!acc[key]) {
                        acc[key] = {
                            id: `adhoc-${key}`,
                            created_at: req.created_at, // Use first request's time
                            status: req.status,
                            session_type: 'Urgent Indent',
                            rak: null,
                            profiles: { name: profileName },
                            isAdhocRequests: true,
                            items: []
                        };
                    }
                    // Add item
                    acc[key].items.push({
                        id: req.id,
                        requested_qty: req.requested_qty,
                        snapshot_max_qty: req.snapshot_max_qty,
                        snapshot_balance: req.snapshot_balance,
                        indent_remarks: req.indent_remarks,
                        inventory_items: req.inventory_items
                    });
                    // For the group status, if any is 'Approved' keep it, else it will be the status of the item
                    if (req.status === 'Approved') {
                        acc[key].status = 'Approved';
                    }
                    return acc;
                }, {});

                processedSessions = [...processedSessions, ...Object.values(groupedRequests)];
                // Sort combined
                processedSessions.sort((a, b) => dayjs(b.created_at).unix() - dayjs(a.created_at).unix());
            }

            setSessions(processedSessions);
        } catch (error) {
            message.error("Failed to load records");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const filteredSessions = useMemo(() => {
        return sessions.filter(session => {
            let matchesDate = true;
            let matchesUser = true;
            let matchesSearch = true;

            if (dateRange && dateRange[0] && dateRange[1]) {
                const sessionDate = dayjs(session.created_at);
                matchesDate = sessionDate.isBetween(dateRange[0], dateRange[1], 'day', '[]');
            }

            if (selectedUser) {
                matchesUser = session.profiles?.name === selectedUser;
            }

            if (debouncedSearch) {
                const lowerSearch = debouncedSearch.toLowerCase();
                if (session.isAdhocRequests) {
                    matchesSearch = session.items.some(item =>
                        item.inventory_items?.name?.toLowerCase().includes(lowerSearch)
                    );
                } else {
                    matchesSearch = session.indent_items?.some(item =>
                        item.inventory_items?.name?.toLowerCase().includes(lowerSearch)
                    ) || false;
                }
            }

            return matchesDate && matchesUser && matchesSearch;
        });
    }, [sessions, dateRange, selectedUser, debouncedSearch]);

    useEffect(() => {
        if (debouncedSearch) {
            setExpandedRowKeys(filteredSessions.map(s => s.id));
        } else {
            setExpandedRowKeys([]);
        }
    }, [debouncedSearch, filteredSessions]);

    const columns = [
        {
            title: 'Date',
            dataIndex: 'created_at',
            key: 'created_at',
            render: (text) => dayjs(text).format('DD/MM/YYYY HH:mm'),
            sorter: (a, b) => dayjs(a.created_at).unix() - dayjs(b.created_at).unix(),
        },
        {
            title: 'Indenter',
            dataIndex: ['profiles', 'name'],
            key: 'indenter',
        },
        {
            title: 'Type',
            dataIndex: 'session_type',
            key: 'type',
        },
        {
            title: 'Rak',
            dataIndex: 'rak',
            key: 'rak',
            render: text => text || '-'
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: status => {
                let color = status === 'Submitted' ? 'blue' : 'green';
                return <span style={{ color }}>{status}</span>;
            }
        },
        {
            title: '',
            key: 'totalItems',
            render: () => <span style={{ color: '#888' }}></span> // We will rely on expandable rows for details
        }
    ];

    const expandedRowRender = (record) => {
        if (record.isAdhocRequests) {
            return <ExpandedItemsTable adhocItems={record.items} debouncedSearch={debouncedSearch} />;
        }
        return <ExpandedItemsTable sessionId={record.id} debouncedSearch={debouncedSearch} />;
    };

    return (
        <div>
            <Title level={3}>Indent Records</Title>

            <Card style={{ marginBottom: 24 }}>
                <Form layout="inline" style={{ rowGap: 16 }}>
                    <Form.Item label="Search Item">
                        <Input.Search
                            placeholder="Search by item name..."
                            allowClear
                            onChange={e => setSearchText(e.target.value)}
                            style={{ width: 250 }}
                        />
                    </Form.Item>
                    <Form.Item label="Date Range">
                        <RangePicker onChange={(dates) => setDateRange(dates)} />
                    </Form.Item>
                    <Form.Item label="Indenter">
                        <Select
                            style={{ width: 200 }}
                            allowClear
                            placeholder="All Users"
                            onChange={v => setSelectedUser(v)}
                        >
                            {users.map(u => <Select.Option key={u.id} value={u.name}>{u.name}</Select.Option>)}
                        </Select>
                    </Form.Item>
                </Form>
            </Card>

            <Card bodyStyle={{ padding: 0 }}>
                <Table
                    columns={columns}
                    dataSource={filteredSessions}
                    rowKey="id"
                    loading={loading}
                    expandable={{
                        expandedRowRender,
                        expandedRowKeys,
                        onExpandedRowsChange: (keys) => setExpandedRowKeys(keys)
                    }}
                />
            </Card>
        </div>
    );
};

// Subcomponent to lazy load items for a given session when expanded
const ExpandedItemsTable = ({ sessionId, adhocItems, debouncedSearch }) => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    const displayItems = useMemo(() => {
        if (!debouncedSearch) return items;
        const lowerSearch = debouncedSearch.toLowerCase();
        return items.filter(item => item.inventory_items?.name?.toLowerCase().includes(lowerSearch));
    }, [items, debouncedSearch]);

    useEffect(() => {
        if (adhocItems) {
            setItems(adhocItems);
            setLoading(false);
            return;
        }

        const fetchItems = async () => {
            const { data, error } = await supabase
                .from('indent_items')
                .select('*, inventory_items(name)')
                .eq('session_id', sessionId);

            if (!error && data) setItems(data);
            setLoading(false);
        };
        fetchItems();
    }, [sessionId, adhocItems]);

    if (loading) return <Spin size="small" />;

    return (
        <List
            size="small"
            dataSource={displayItems}
            rowKey="id"
            renderItem={item => (
                <List.Item>
                    <List.Item.Meta
                        title={<Typography.Text strong>{item.inventory_items?.name}</Typography.Text>}
                    />
                    <Space size="large" wrap>
                        <Space>
                            <Typography.Text type="secondary">Max Qty:</Typography.Text>
                            <Typography.Text>{item.snapshot_max_qty !== null && item.snapshot_max_qty !== undefined ? item.snapshot_max_qty : '-'}</Typography.Text>
                        </Space>
                        <Space>
                            <Typography.Text type="secondary">Balance:</Typography.Text>
                            <Typography.Text>{item.snapshot_balance !== null && item.snapshot_balance !== undefined ? item.snapshot_balance : '-'}</Typography.Text>
                        </Space>
                        <Space>
                            <Typography.Text type="secondary">Indent Qty:</Typography.Text>
                            <Typography.Text strong style={{ color: '#1890ff' }}>{item.requested_qty}</Typography.Text>
                        </Space>
                        {item.indent_remarks && (
                            <Space>
                                <Typography.Text type="secondary">Remarks:</Typography.Text>
                                <Typography.Text>{item.indent_remarks}</Typography.Text>
                            </Space>
                        )}
                    </Space>
                </List.Item>
            )}
        />
    );
};

export default IndentRecordPage;
