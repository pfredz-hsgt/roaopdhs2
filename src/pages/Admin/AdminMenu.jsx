import React, { useState, useEffect } from 'react';
import { Typography, Tabs, Table, Button, Modal, Form, Input, Select, message, Popconfirm, Card, Spin, Space } from 'antd';
import { UserOutlined, DatabaseOutlined, PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { supabase } from '../../lib/supabase';

const { Title } = Typography;
const { Option } = Select;

const AdminMenuPage = () => {
    return (
        <div>
            <Title level={3}>Admin Control Panel</Title>
            <Tabs defaultActiveKey="1" style={{ marginTop: 24 }}>
                <Tabs.TabPane tab={<span><UserOutlined />User Management</span>} key="1">
                    <UserManagement />
                </Tabs.TabPane>
                <Tabs.TabPane tab={<span><DatabaseOutlined />Inventory Settings</span>} key="2">
                    <div style={{ padding: 24, textAlign: 'center' }}>
                        <Typography.Text type="secondary">
                            Inventory CRUD capabilities are usually handled via backend scripts or external ETL tools in this application.
                            If you need a dedicated frontend UI for creating/deleting stock, you can add it here.
                        </Typography.Text>
                        <br /><br />
                        <Button type="primary" onClick={() => message.info('Placeholder for full Inventory CRUD grid.')}>Open Inventory Editor</Button>
                    </div>
                </Tabs.TabPane>
            </Tabs>
        </div>
    );
};

const UserManagement = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [form] = Form.useForm();
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.from('profiles').select('*').order('name');
            if (error) throw error;
            setUsers(data || []);
        } catch (error) {
            console.error(error);
            message.error("Failed to fetch users");
        } finally {
            setLoading(false);
        }
    };

    const handleCreateUser = async (values) => {
        setSubmitting(true);
        try {
            // Note: In Supabase, creating an Auth user via frontend requires either the Service Role Key (Admin API)
            // or calling an Edge Function, OR the user must sign up themselves if public signups are allowed.
            // For this implementation, we simulate it via Edge Function or just insert into profiles if using basic auth hooks.

            // To be secure, the ideal approach is an Edge Function called `create-user`.
            // Here, we'll try to insert using the standard method assuming public signups are on, 
            // or prompt the admin to use the dashboard / backend script.

            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: values.email,
                password: values.password,
            });

            if (authError) {
                if (authError.message.includes('allow public signups')) {
                    message.warning("Please create the user via the Supabase Dashboard Authentication panel, then the profile will map automatically.");
                } else {
                    throw authError;
                }
                return;
            }

            // Upsert profile
            if (authData?.user) {
                const { error: profileError } = await supabase.from('profiles').upsert({
                    id: authData.user.id,
                    name: values.name,
                    email: values.email,
                    role: values.role
                });

                if (profileError) throw profileError;
                message.success("User created successfully");
                setIsModalVisible(false);
                form.resetFields();
                fetchUsers();
            }

        } catch (error) {
            console.error(error);
            message.error(error.message || "Failed to create user");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteUser = async (user) => {
        // Generally deleting from profiles table won't delete from auth.users, 
        // but it removes their access to the app since RBAC relies on profiles.
        try {
            const { error } = await supabase.from('profiles').delete().eq('id', user.id);
            if (error) throw error;
            message.success("User profile removed");
            fetchUsers();
        } catch (error) {
            message.error("Failed to delete user");
        }
    };

    const columns = [
        { title: 'Name', dataIndex: 'name', key: 'name' },
        { title: 'Email', dataIndex: 'email', key: 'email' },
        { title: 'Role', dataIndex: 'role', key: 'role', render: text => <span style={{ color: text === 'Issuer' ? '#1890ff' : '#52c41a' }}>{text}</span> },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
                <Popconfirm
                    title="Delete user profile?"
                    onConfirm={() => handleDeleteUser(record)}
                >
                    <Button danger icon={<DeleteOutlined />} size="small" />
                </Popconfirm>
            )
        }
    ];

    if (loading) return <Spin />;

    return (
        <Card bodyStyle={{ padding: 0 }}>
            <div style={{ padding: 16, display: 'flex', justifyContent: 'flex-end' }}>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalVisible(true)}>Add New User</Button>
            </div>

            <Table columns={columns} dataSource={users} rowKey="id" pagination={{ pageSize: 10 }} />

            <Modal
                title="Create New User"
                open={isModalVisible}
                onCancel={() => { setIsModalVisible(false); form.resetFields(); }}
                footer={null}
            >
                <Form layout="vertical" form={form} onFinish={handleCreateUser}>
                    <Form.Item name="name" label="Name" rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="password" label="Temporary Password" rules={[{ required: true }]}>
                        <Input.Password />
                    </Form.Item>
                    <Form.Item name="role" label="Role" rules={[{ required: true }]}>
                        <Select>
                            <Option value="Indenter">Indenter</Option>
                            <Option value="Issuer">Issuer (Admin)</Option>
                        </Select>
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" loading={submitting} block>Create User</Button>
                    </Form.Item>
                </Form>
            </Modal>
        </Card>
    );
};

export default AdminMenuPage;
