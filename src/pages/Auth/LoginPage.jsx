import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Layout, Card, Form, Input, Button, Typography, message, Modal } from 'antd';
import { UserOutlined, MedicineBoxOutlined, MailOutlined } from '@ant-design/icons';

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
        <Layout className="login-bg">
            <style>{`
                .login-bg {
                    background-color: #f0f2f5;
                    background-image: 
                        radial-gradient(at 0% 0%, rgba(24, 144, 255, 0.15) 0px, transparent 50%),
                        radial-gradient(at 100% 0%, rgba(0, 209, 178, 0.15) 0px, transparent 50%),
                        radial-gradient(at 100% 100%, rgba(24, 144, 255, 0.15) 0px, transparent 50%),
                        radial-gradient(at 0% 100%, rgba(0, 209, 178, 0.15) 0px, transparent 50%);
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .glass-card {
                    width: 100%;
                    max-width: 420px;
                    background: rgba(255, 255, 255, 0.7) !important;
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    border: 1px solid rgba(255, 255, 255, 0.5) !important;
                    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.05) !important;
                    border-radius: 24px !important;
                }
                .glass-card .ant-card-body {
                    padding: 40px 32px !important;
                }
                .login-input .ant-input-affix-wrapper, .login-input.ant-input {
                    border-radius: 12px;
                    padding: 12px 16px;
                    background: rgba(255, 255, 255, 0.8);
                    transition: all 0.3s ease;
                }
                .login-btn {
                    border-radius: 12px;
                    height: 50px;
                    font-size: 16px;
                    font-weight: 600;
                    margin-top: 8px;
                    background: linear-gradient(135deg, #1890ff 0%, #096dd9 100%);
                    border: none;
                    box-shadow: 0 4px 14px 0 rgba(24, 144, 255, 0.39);
                    transition: all 0.3s ease;
                }
                .login-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(24, 144, 255, 0.45);
                    background: linear-gradient(135deg, #40a9ff 0%, #1890ff 100%);
                }
                .forgot-btn {
                    color: #595959;
                    font-weight: 500;
                    transition: color 0.3s ease;
                }
                .forgot-btn:hover {
                    color: #1890ff;
                }
            `}</style>

            <Card className="glass-card" bordered={false}>
                <div style={{ textAlign: 'center', marginBottom: 36 }}>
                    <div style={{
                        display: 'inline-block',
                        padding: '12px',
                        background: 'linear-gradient(135deg, rgba(24,144,255,0.1) 0%, rgba(0,209,178,0.1) 100%)',
                        borderRadius: '50%',
                        marginBottom: '16px'
                    }}>
                        <MedicineBoxOutlined style={{ fontSize: '32px', color: '#1890ff' }} />
                    </div>
                    <Title level={2} style={{
                        margin: 0,
                        letterSpacing: '5px',
                        fontWeight: 700,
                        background: 'linear-gradient(to right, #1890ff 0%, #00d1b2 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        textTransform: 'uppercase',
                        fontSize: '32px',
                    }}>
                        ARISE
                    </Title>
                    <Text type="secondary" style={{
                        fontSize: '13px',
                        letterSpacing: '1.2px',
                        textTransform: 'uppercase',
                        display: 'block',
                        marginTop: '12px',
                        fontWeight: 600,
                        color: '#8c8c8c'
                    }}>
                        Farmasi Pesakit Luar<br />Hospital Segamat
                    </Text>
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
                        <Input
                            className="login-input"
                            prefix={<UserOutlined style={{ color: '#bfbfbf', marginRight: '8px' }} />}
                            placeholder="Email Address"
                        />
                    </Form.Item>
                    <Form.Item
                        name="password"
                        rules={[{ required: true, message: 'Please input your Password!' }]}
                    >
                        <Input.Password
                            className="login-input"
                            prefix={<MedicineBoxOutlined style={{ color: '#bfbfbf', marginRight: '8px' }} />}
                            placeholder="Password"
                        />
                    </Form.Item>

                    <Form.Item style={{ marginBottom: 0 }}>
                        <Button type="primary" htmlType="submit" loading={loading} block className="login-btn">
                            Sign In
                        </Button>
                        <div style={{ textAlign: 'center', marginTop: 20 }}>
                            <Button type="link" onClick={() => setResetModalVisible(true)} className="forgot-btn" style={{ padding: 0 }}>
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
