import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Layout, Card, Form, Input, Button, Typography, message } from 'antd';
import { LockOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const ResetPasswordPage = () => {
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const checkSession = async () => {
            const hash = window.location.hash;
            let currentSession = null;
            
            // In HashRouter, Supabase often fails to automatically parse the token 
            // because the hash looks like #/reset-password#access_token=...
            if (hash.includes('access_token')) {
                const accessMatch = hash.match(/access_token=([^&]+)/);
                const refreshMatch = hash.match(/refresh_token=([^&]+)/);
                
                if (accessMatch && refreshMatch) {
                    const { data, error } = await supabase.auth.setSession({
                        access_token: accessMatch[1],
                        refresh_token: refreshMatch[1]
                    });
                    
                    if (!error && data.session) {
                        currentSession = data.session;
                        // Clear the token from the URL for security
                        window.location.hash = '#/reset-password';
                    }
                }
            } else {
                const { data } = await supabase.auth.getSession();
                currentSession = data.session;
            }
            
            if (!currentSession) {
                message.error('Invalid or expired password reset link');
                navigate('/login');
            }
        };
        
        checkSession();
    }, [navigate]);

    const onFinish = async (values) => {
        setLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({
                password: values.password
            });

            if (error) throw error;

            message.success('Password updated successfully!');
            navigate('/');
        } catch (error) {
            message.error(error.message || 'Failed to update password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
            <Card style={{ width: 400, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', borderRadius: 12 }}>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <Title level={3} style={{ margin: 0, color: '#1890ff' }}>Reset Password</Title>
                    <Text type="secondary">Enter your new password below</Text>
                </div>

                <Form
                    name="reset_password"
                    onFinish={onFinish}
                    layout="vertical"
                    size="large"
                >
                    <Form.Item
                        name="password"
                        rules={[
                            { required: true, message: 'Please input your new password!' },
                            { min: 6, message: 'Password must be at least 6 characters!' }
                        ]}
                        hasFeedback
                    >
                        <Input.Password prefix={<LockOutlined style={{ color: 'rgba(0,0,0,.25)' }} />} placeholder="New Password" />
                    </Form.Item>

                    <Form.Item
                        name="confirm"
                        dependencies={['password']}
                        hasFeedback
                        rules={[
                            { required: true, message: 'Please confirm your password!' },
                            ({ getFieldValue }) => ({
                                validator(_, value) {
                                    if (!value || getFieldValue('password') === value) {
                                        return Promise.resolve();
                                    }
                                    return Promise.reject(new Error('The two passwords do not match!'));
                                },
                            }),
                        ]}
                    >
                        <Input.Password prefix={<LockOutlined style={{ color: 'rgba(0,0,0,.25)' }} />} placeholder="Confirm Password" />
                    </Form.Item>

                    <Form.Item style={{ marginBottom: 0 }}>
                        <Button type="primary" htmlType="submit" loading={loading} block>
                            Update Password
                        </Button>
                    </Form.Item>
                </Form>
            </Card>
        </Layout>
    );
};

export default ResetPasswordPage;
