import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Typography, Drawer, Button, Avatar, Dropdown, Modal, Form, Input, message } from 'antd';
import {
    SearchOutlined,
    ShoppingCartOutlined,
    FileTextOutlined,
    SettingOutlined,
    MenuOutlined,
    PushpinOutlined,
    WarningOutlined,
    HistoryOutlined,
    UserOutlined,
    LogoutOutlined,
    HomeOutlined,
    LockOutlined
} from '@ant-design/icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

const MainLayout = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const { user, profile, isIssuer, signOut } = useAuth();

    const [passwordModalVisible, setPasswordModalVisible] = useState(false);
    const [passwordForm] = Form.useForm();
    const [changingPassword, setChangingPassword] = useState(false);

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    const handleChangePassword = async (values) => {
        setChangingPassword(true);
        try {
            const { error } = await supabase.auth.updateUser({
                password: values.newPassword
            });
            if (error) throw error;
            message.success('Password updated successfully');
            setPasswordModalVisible(false);
            passwordForm.resetFields();
        } catch (error) {
            console.error('Error updating password:', error);
            message.error(error.message || 'Failed to update password');
        } finally {
            setChangingPassword(false);
        }
    };

    const userMenu = {
        items: [
            {
                key: 'profile',
                label: <Text strong>{profile?.name}</Text>
            },
            {
                key: 'role',
                label: <Text type="secondary">{profile?.role}</Text>
            },
            {
                type: 'divider'
            },
            {
                key: 'changePassword',
                icon: <LockOutlined />,
                label: 'Change Password',
                onClick: () => setPasswordModalVisible(true)
            },
            {
                key: 'logout',
                icon: <LogoutOutlined />,
                label: 'Sign Out',
                onClick: handleSignOut
            }
        ]
    };

    // Base menu items available to all
    let menuItems = [
        {
            key: '/home',
            icon: <HomeOutlined />,
            label: 'Home',
        },
        {
            key: '/routine-summary',
            icon: <PushpinOutlined />,
            label: 'Routine Indent',
        },
        {
            key: '/indent',
            icon: <FileTextOutlined />,
            label: 'Urgent Indent',
        },
        {
            type: 'divider',
            style: {
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                margin: '12px 16px'
            }
        },
        {
            key: '/indent-list',
            icon: <HistoryOutlined />,
            label: 'Records',
        },
        {
            key: '/shortexp',
            icon: <WarningOutlined />,
            label: 'Kew.PS-6',
        },

    ];

    // Inject Issuer-only menus before settings
    if (isIssuer) {
        menuItems.splice(4, 0,
            {
                key: '/cart',
                icon: <ShoppingCartOutlined />,
                label: 'Cart',
            },
            {
                key: '/admin',
                icon: <SettingOutlined />,
                label: 'Admin Panel',
            }
        );
    }

    const handleMenuClick = ({ key }) => {
        navigate(key);
        setMobileMenuOpen(false);
    };

    return (
        <Layout style={{ minHeight: '100vh' }}>
            {/* Desktop Sidebar */}
            <Sider
                breakpoint="lg"
                collapsedWidth="0"
                onCollapse={setCollapsed}
                style={{
                    overflow: 'auto',
                    height: '100vh',
                    position: 'fixed',
                    left: 0,
                    top: 0,
                    bottom: 0,
                }}
                className="desktop-sider"
            >
                <div style={{ padding: '24px 16px', textAlign: 'center', background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%)', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <Title level={4} style={{
                        color: 'white',
                        margin: 0,
                        letterSpacing: '6px',
                        fontWeight: 450,
                        background: 'linear-gradient(to right, #66fff7ff 0%, #67ffd9ff 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        textTransform: 'uppercase',
                        fontSize: '26px',
                        fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
                    }}>
                        ARISE
                    </Title>
                    <Typography.Text style={{
                        color: 'rgba(255,255,255,0.5)',
                        fontSize: '10px',
                        letterSpacing: '0.5px',
                        textTransform: 'uppercase',
                        display: 'block',
                        marginTop: '4px',
                        fontWeight: 400
                    }}>
                        Farmasi Pesakit Luar<br />Hospital Segamat
                    </Typography.Text>
                </div>
                <Menu
                    theme="dark"
                    mode="inline"
                    selectedKeys={[location.pathname]}
                    items={menuItems}
                    onClick={handleMenuClick}
                />
            </Sider>

            {/* Mobile Drawer */}
            <Drawer
                placement="left"
                onClose={() => setMobileMenuOpen(false)}
                open={mobileMenuOpen}
                className="mobile-drawer"
                styles={{
                    body: { padding: 0, backgroundColor: '#001529' },
                    header: { display: 'none' }
                }}
                width={200}
            >
                <div style={{ padding: '24px 16px', textAlign: 'center', background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%)', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <Title level={4} style={{
                        color: 'white',
                        margin: 0,
                        letterSpacing: '6px',
                        fontWeight: 450,
                        background: 'linear-gradient(to right, #66fff7ff 0%, #67ffd9ff 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        textTransform: 'uppercase',
                        fontSize: '26px',
                        fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
                    }}>
                        ARISE
                    </Title>
                    <Typography.Text style={{
                        color: 'rgba(255,255,255,0.5)',
                        fontSize: '10px',
                        letterSpacing: '0.5px',
                        textTransform: 'uppercase',
                        display: 'block',
                        marginTop: '4px',
                        fontWeight: 400
                    }}>
                        Farmasi Pesakit Luar<br />Hospital Segamat
                    </Typography.Text>
                </div>
                <Menu
                    theme="dark"
                    mode="inline"
                    selectedKeys={[location.pathname]}
                    items={menuItems}
                    onClick={handleMenuClick}
                />
            </Drawer>

            <Layout style={{ marginLeft: collapsed ? 0 : 200 }}>
                <Header
                    className="site-header"
                    style={{
                        padding: '0 16px',
                        background: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <Button
                            type="text"
                            icon={<MenuOutlined />}
                            onClick={() => setMobileMenuOpen(true)}
                            className="mobile-menu-button"
                            style={{ fontSize: '18px', marginRight: 16 }}
                        />
                        <Title level={4} style={{ margin: 0 }}>
                            {menuItems.find(item => item.key === location.pathname)?.label || 'ARISE'}
                        </Title>
                    </div>

                    <div>
                        {user && (
                            <Dropdown menu={userMenu} placement="bottomRight" trigger={['click']}>
                                <Avatar
                                    style={{ backgroundColor: '#1890ff', cursor: 'pointer' }}
                                    icon={<UserOutlined />}
                                />
                            </Dropdown>
                        )}
                    </div>
                </Header>
                <Content className="site-content" style={{ margin: '24px 16px', overflow: 'initial' }}>
                    <div style={{ padding: 24, background: '#fff', minHeight: 360, borderRadius: 8 }}>
                        <Outlet />
                    </div>
                </Content>
            </Layout>

            {/* Change Password Modal */}
            <Modal
                title="Change Password"
                open={passwordModalVisible}
                onCancel={() => {
                    setPasswordModalVisible(false);
                    passwordForm.resetFields();
                }}
                onOk={() => passwordForm.submit()}
                confirmLoading={changingPassword}
                okText="Update Password"
            >
                <Form
                    form={passwordForm}
                    layout="vertical"
                    onFinish={handleChangePassword}
                >
                    <Form.Item
                        name="newPassword"
                        label="New Password"
                        rules={[
                            { required: true, message: 'Please input your new password!' },
                            { min: 6, message: 'Password must be at least 6 characters!' }
                        ]}
                    >
                        <Input.Password placeholder="Enter new password" />
                    </Form.Item>
                    <Form.Item
                        name="confirmPassword"
                        label="Confirm New Password"
                        dependencies={['newPassword']}
                        rules={[
                            { required: true, message: 'Please confirm your new password!' },
                            ({ getFieldValue }) => ({
                                validator(_, value) {
                                    if (!value || getFieldValue('newPassword') === value) {
                                        return Promise.resolve();
                                    }
                                    return Promise.reject(new Error('The two passwords that you entered do not match!'));
                                },
                            }),
                        ]}
                    >
                        <Input.Password placeholder="Confirm new password" />
                    </Form.Item>
                </Form>
            </Modal>

            <style>{`
        @media (min-width: 992px) {
          .mobile-menu-button {
            display: none !important;
          }
          .mobile-drawer {
            display: none;
          }
        }
        @media (max-width: 991px) {
          .desktop-sider {
            display: none !important;
          }
          .site-header {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 1000;
            width: 100%;
          }
          .site-content {
            margin-top: 88px !important; /* 64px header + 24px existing top margin */
          }
        }
      `}</style>
        </Layout>
    );
};

export default MainLayout;
