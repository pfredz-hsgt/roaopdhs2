import React, { useState, useEffect } from 'react';
import {
    Table,
    Button,
    Modal,
    Form,
    Input,
    Select,
    InputNumber,
    Space,
    message,
    Popconfirm,
} from 'antd';
import { PlusOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import { supabase } from '../../lib/supabase';

const { TextArea } = Input;

const InventoryTable = () => {
    const [drugs, setDrugs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingDrug, setEditingDrug] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [form] = Form.useForm();

    useEffect(() => {
        fetchDrugs();
        setupRealtimeSubscription();
    }, []);

    const fetchDrugs = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('inventory_items')
                .select('*')
                .order('name', { ascending: true });

            if (error) throw error;

            setDrugs(data || []);
        } catch (error) {
            console.error('Error fetching drugs:', error);
            message.error('Failed to load inventory items');
        } finally {
            setLoading(false);
        }
    };

    const setupRealtimeSubscription = () => {
        const subscription = supabase
            .channel('inventory_table_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'inventory_items',
                },
                () => {
                    fetchDrugs();
                }
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    };

    const handleAdd = () => {
        setEditingDrug(null);
        form.resetFields();
        setModalVisible(true);
    };

    const handleEdit = (drug) => {
        setEditingDrug(drug);
        form.setFieldsValue(drug);
        setModalVisible(true);
    };

    const handleDelete = async (id) => {
        try {
            const { error } = await supabase
                .from('inventory_items')
                .delete()
                .eq('id', id);

            if (error) throw error;

            message.success('Drug deleted successfully');
            fetchDrugs();
        } catch (error) {
            console.error('Error deleting drug:', error);
            message.error('Failed to delete drug');
        }
    };

    const handleSubmit = async (values) => {
        try {
            if (editingDrug) {
                // Update existing drug
                const { error } = await supabase
                    .from('inventory_items')
                    .update(values)
                    .eq('id', editingDrug.id);

                if (error) throw error;

                message.success('Drug updated successfully');
            } else {
                // Insert new drug
                const { error } = await supabase
                    .from('inventory_items')
                    .insert(values);

                if (error) throw error;

                message.success('Drug added successfully');
            }

            setModalVisible(false);
            form.resetFields();
            fetchDrugs();
        } catch (error) {
            console.error('Error saving drug:', error);
            message.error('Failed to save drug');
        }
    };

    const columns = [
        {
            title: 'Name',
            dataIndex: 'name',
            key: 'name',
            sorter: (a, b) => a.name.localeCompare(b.name),
            width: 200,
        },
        {
            title: 'Item Code',
            dataIndex: 'item_code',
            key: 'item_code',
            width: 100,
        },
        {
            title: 'PKU',
            dataIndex: 'pku',
            key: 'pku',
            width: 100,
        },
        {
            title: 'Purchase Type',
            dataIndex: 'puchase_type',
            key: 'puchase_type',
            filters: [
                { text: 'LP', value: 'LP' },
                { text: 'APPL', value: 'APPL' },
            ],
            onFilter: (value, record) => record.puchase_type === value,
            width: 100,
        },
        {
            title: 'STD/KT',
            dataIndex: 'std_kt',
            key: 'std_kt',
            filters: [
                { text: 'STD', value: 'STD' },
                { text: 'KT', value: 'KT' },
            ],
            onFilter: (value, record) => record.std_kt === value,
            width: 80,
        },
        {
            title: 'Row',
            dataIndex: 'row',
            key: 'row',
            filters: [
                { text: 'A', value: 'A' },
                { text: 'B', value: 'B' },
                { text: 'C', value: 'C' },
                { text: 'D', value: 'D' },
                { text: 'E', value: 'E' },
                { text: 'F', value: 'F' },
                { text: 'G', value: 'G' },
                { text: 'H', value: 'H' },
                { text: 'I', value: 'I' },
                { text: 'J', value: 'J' },
            ],
            onFilter: (value, record) => record.row === value,
            width: 80,
        },
        {
            title: 'Max Qty',
            dataIndex: 'max_qty',
            key: 'max_qty',
            width: 80,
        },
        {
            title: 'Balance',
            dataIndex: 'balance',
            key: 'balance',
            width: 80,
        },
        {
            title: 'Source',
            dataIndex: 'indent_source',
            key: 'indent_source',
            filters: [
                { text: 'OPD Kaunter', value: 'OPD Kaunter' },
                { text: 'OPD Substor', value: 'OPD Substor' },
                { text: 'IPD Kaunter', value: 'IPD Kaunter' },
                { text: 'IPD Substor', value: 'IPD Substor' },
                { text: 'MNF Substor', value: 'MNF Substor' },
                { text: 'MNF Eksternal', value: 'MNF Eksternal' },
                { text: 'MNF Internal', value: 'MNF Internal' },
                { text: 'Prepacking', value: 'Prepacking' },
                { text: 'HPSF Muar', value: 'HPSF Muar' },
            ],
            onFilter: (value, record) => record.indent_source === value,
            width: 120,
        },
        {
            title: 'Remarks',
            dataIndex: 'remarks',
            key: 'remarks',
            ellipsis: true,
            width: 200,
        },
        {
            title: 'Actions',
            key: 'actions',
            width: 80,
            align: 'center',
            render: (_, record) => (
                <Popconfirm
                    title="Delete this drug?"
                    onConfirm={(e) => {
                        e.stopPropagation();
                        handleDelete(record.id);
                    }}
                    okText="Yes"
                    cancelText="No"
                    onCancel={(e) => e.stopPropagation()}
                >
                    <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={(e) => e.stopPropagation()}
                    />
                </Popconfirm>
            ),
        },
    ];

    // Filter drugs based on search query
    const filteredDrugs = drugs.filter((drug) => {
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase();
        return (
            drug.name?.toLowerCase().includes(query) ||
            drug.item_code?.toLowerCase().includes(query) ||
            drug.pku?.toLowerCase().includes(query) ||
            drug.row?.toLowerCase().includes(query) ||
            drug.remarks?.toLowerCase().includes(query)
        );
    });

    // Handle Enter key for modal submission
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!modalVisible) return;

            // Allow Enter in TextArea to function normally (new line)
            if (e.target.tagName.toLowerCase() === 'textarea') return;

            if (e.key === 'Enter') {
                e.preventDefault();
                form.submit();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [modalVisible, form]);

    return (
        <div>
            <div style={{ marginBottom: 16, display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <Input
                    placeholder="Search by name, item code, PKU, row, or remarks..."
                    prefix={<SearchOutlined />}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ flex: '1 1 300px', maxWidth: '500px' }}
                    allowClear
                />
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleAdd}
                >
                    Add New Drug
                </Button>
            </div>

            <Table
                columns={columns}
                dataSource={filteredDrugs}
                showSorterTooltip={false}
                rowKey="id"
                loading={loading}
                scroll={{ x: 1200 }}
                onRow={(record) => ({
                    onClick: () => handleEdit(record),
                    style: { cursor: 'pointer' },
                })}
                pagination={{
                    defaultPageSize: 10,
                    showSizeChanger: true,
                    showTotal: (total) => `Total ${total} items`,
                }}
            />

            <Modal
                title={editingDrug ? 'Edit Drug' : 'Add New Drug'}
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                onOk={() => form.submit()}
                width={600}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                >
                    <Form.Item
                        name="name"
                        label="Drug Name"
                        rules={[{ required: true, message: 'Please enter drug name' }]}
                    >
                        <Input placeholder="e.g., Paracetamol 500mg" />
                    </Form.Item>

                    <Space style={{ width: '100%' }} size="large">
                        <Form.Item
                            name="item_code"
                            label="Item Code"
                        >
                            <Input placeholder="e.g., ITEM001" style={{ width: 150 }} />
                        </Form.Item>

                        <Form.Item
                            name="pku"
                            label="PKU"
                        >
                            <Input placeholder="e.g., PKU001" style={{ width: 150 }} />
                        </Form.Item>
                    </Space>

                    <Space style={{ width: '100%' }} size="large">
                        <Form.Item
                            name="puchase_type"
                            label="Purchase Type"
                        >
                            <Select placeholder="Select type" style={{ width: 150 }}>
                                <Select.Option value="LP">LP</Select.Option>
                                <Select.Option value="APPL">APPL</Select.Option>
                            </Select>
                        </Form.Item>

                        <Form.Item
                            name="std_kt"
                            label="STD/KT"
                        >
                            <Select placeholder="Select" style={{ width: 150 }}>
                                <Select.Option value="STD">STD</Select.Option>
                                <Select.Option value="KT">KT</Select.Option>
                            </Select>
                        </Form.Item>
                    </Space>

                    <Space style={{ width: '100%' }} size="large">
                        <Form.Item
                            name="row"
                            label="Row"
                        >
                            <Input placeholder="e.g., A1" style={{ width: 120 }} />
                        </Form.Item>

                        <Form.Item name="max_qty" label="Max Quantity">
                            <InputNumber placeholder="Max Qty" style={{ width: 120 }} min={0} />
                        </Form.Item>

                        <Form.Item name="balance" label="Balance">
                            <InputNumber placeholder="Balance" style={{ width: 120 }} min={0} />
                        </Form.Item>
                    </Space>

                    <Form.Item name="indent_source" label="Indent Source">
                        <Select placeholder="Select source">
                            <Select.Option value="OPD Kaunter">OPD Kaunter</Select.Option>
                            <Select.Option value="OPD Substor">OPD Substor</Select.Option>
                            <Select.Option value="IPD Kaunter">IPD Kaunter</Select.Option>
                            <Select.Option value="IPD Substor">IPD Substor</Select.Option>
                            <Select.Option value="MNF Substor">MNF Substor</Select.Option>
                            <Select.Option value="MNF Eksternal">MNF Eksternal</Select.Option>
                            <Select.Option value="MNF Internal">MNF Internal</Select.Option>
                            <Select.Option value="Prepacking">Prepacking</Select.Option>
                            <Select.Option value="HPSF Muar">HPSF Muar</Select.Option>
                        </Select>
                    </Form.Item>

                    <Form.Item name="remarks" label="Remarks">
                        <TextArea
                            rows={3}
                            placeholder="Any special notes or instructions..."
                        />
                    </Form.Item>

                    <Form.Item name="image_url" label="Image URL">
                        <Input placeholder="https://..." />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default InventoryTable;
