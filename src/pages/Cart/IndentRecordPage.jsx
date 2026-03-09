import React, { useState, useEffect } from 'react';
import { Table, Typography, Card, Spin, message, DatePicker, Select, Form, Space } from 'antd';
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
            const { data, error } = await supabase
                .from('indent_sessions')
                .select(`
                    id, 
                    created_at, 
                    status, 
                    session_type, 
                    rak,
                    profiles(name)
                `)
                .in('status', ['Submitted', 'Approved', 'Completed'])
                .order('created_at', { ascending: false });

            if (error) throw error;
            setSessions(data || []);
        } catch (error) {
            message.error("Failed to load records");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const filteredSessions = sessions.filter(session => {
        let matchesDate = true;
        let matchesUser = true;

        if (dateRange && dateRange[0] && dateRange[1]) {
            const sessionDate = dayjs(session.created_at);
            matchesDate = sessionDate.isBetween(dateRange[0], dateRange[1], 'day', '[]');
        }

        if (selectedUser) {
            matchesUser = session.profiles?.name === selectedUser;
        }

        return matchesDate && matchesUser;
    });

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
            title: 'Total Items',
            key: 'totalItems',
            render: () => <span style={{ color: '#888' }}>Click Expand</span> // We will rely on expandable rows for details
        }
    ];

    const expandedRowRender = (record) => {
        return <ExpandedItemsTable sessionId={record.id} />;
    };

    return (
        <div>
            <Title level={3}>Indent Records</Title>

            <Card style={{ marginBottom: 24 }}>
                <Form layout="inline">
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
                    expandable={{ expandedRowRender }}
                />
            </Card>
        </div>
    );
};

// Subcomponent to lazy load items for a given session when expanded
const ExpandedItemsTable = ({ sessionId }) => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchItems = async () => {
            const { data, error } = await supabase
                .from('indent_items')
                .select('*, inventory_items(name)')
                .eq('session_id', sessionId);

            if (!error && data) setItems(data);
            setLoading(false);
        };
        fetchItems();
    }, [sessionId]);

    const itemColumns = [
        { title: 'Item', dataIndex: ['inventory_items', 'name'], key: 'name' },
        { title: 'Max Qty (Snapshot)', dataIndex: 'snapshot_max_qty', key: 'max_qty', render: t => t !== null && t !== undefined ? t : '-' },
        { title: 'Balance (Snapshot)', dataIndex: 'snapshot_balance', key: 'balance', render: t => t !== null && t !== undefined ? t : '-' },
        { title: 'Indent Qty', dataIndex: 'requested_qty', key: 'qty' },
        { title: 'Remarks', dataIndex: 'indent_remarks', key: 'remarks', render: t => t || '-' }
    ];

    if (loading) return <Spin size="small" />;

    return (
        <Table
            columns={itemColumns}
            dataSource={items}
            rowKey="id"
            pagination={false}
            size="small"
        />
    );
};

export default IndentRecordPage;
