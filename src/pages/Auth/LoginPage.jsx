import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Layout, Card, Form, Input, Button, Typography, message, Modal } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const LoginPage = () => {
    const [loading, setLoading] = useState(false);
    const [resetModalVisible, setResetModalVisible] = useState(false);
    const [resetLoading, setResetLoading] = useState(false);
    const [resetForm] = Form.useForm();
    const navigate = useNavigate();

    const onFinish = async (values) => {
        setLoading(true);
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email: values.email,
                password: values.password,
            });

            if (error) throw error;

            navigate('/');
        } catch (error) {
            message.error(error.message || 'Failed to sign in');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (values) => {
        setResetLoading(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(values.resetEmail, {
                redirectTo: `${window.location.origin}/#/reset-password`,
            });

            if (error) throw error;

            message.success('Password recovery email sent! Please check your inbox.');
            setResetModalVisible(false);
            resetForm.resetFields();
        } catch (error) {
            message.error(error.message || 'Failed to send recovery email');
        } finally {
            setResetLoading(false);
        }
    };

    return (
        <Layout style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
            <Card style={{ width: 400, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', borderRadius: 12 }}>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <Title level={3} style={{ margin: 0, color: '#1890ff' }}>OPDHS v2</Title>
                    <Text type="secondary">Pharmacy Inventory Management</Text>
                </div>

                <Form
                    name="login"
                    onFinish={onFinish}
                    layout="vertical"
                    size="large"
                >
                    <Form.Item
                        name="email"
                        rules={[{ required: true, message: 'Please input your Email!' }]}
                    >
                        <Input prefix={<UserOutlined style={{ color: 'rgba(0,0,0,.25)' }} />} placeholder="Email" />
                    </Form.Item>
                    <Form.Item
                        name="password"
                        rules={[{ required: true, message: 'Please input your Password!' }]}
                    >
                        <Input.Password prefix={<LockOutlined style={{ color: 'rgba(0,0,0,.25)' }} />} placeholder="Password" />
                    </Form.Item>

                    <Form.Item>
                        <Button type="primary" htmlType="submit" loading={loading} block>
                            Log in
                        </Button>
                        <div style={{ textAlign: 'center', marginTop: 16 }}>
                            <Button type="link" onClick={() => setResetModalVisible(true)} style={{ padding: 0 }}>
                                Forgot Password?
                            </Button>
                        </div>
                    </Form.Item>
                </Form>
            </Card>

            <Modal
                title="Reset Password"
                open={resetModalVisible}
                onCancel={() => {
                    setResetModalVisible(false);
                    resetForm.resetFields();
                }}
                footer={null}
                destroyOnClose
            >
                <div style={{ marginBottom: 24 }}>
                    <Text type="secondary">
                        Enter your email address and we will send you a link to reset your password.
                    </Text>
                </div>
                <Form
                    form={resetForm}
                    onFinish={handleResetPassword}
                    layout="vertical"
                >
                    <Form.Item
                        name="resetEmail"
                        rules={[
                            { required: true, message: 'Please input your email!' },
                            { type: 'email', message: 'Please enter a valid email!' }
                        ]}
                    >
                        <Input prefix={<MailOutlined style={{ color: 'rgba(0,0,0,.25)' }} />} placeholder="Email address" size="large" />
                    </Form.Item>
                    <Form.Item style={{ marginBottom: 0 }}>
                        <Button type="primary" htmlType="submit" loading={resetLoading} block size="large">
                            Send Reset Link
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>
        </Layout>
    );
};

export default LoginPage;
