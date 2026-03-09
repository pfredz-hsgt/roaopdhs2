import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Typography, Drawer, Button, Avatar, Dropdown } from 'antd';
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
    HomeOutlined
} from '@ant-design/icons';
import { useAuth } from '../../contexts/AuthContext';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

const MainLayout = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const { user, profile, isIssuer, signOut } = useAuth();

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    const userMenu = {
        items: [
            {
                key: 'profile',
                label: <Text strong>{profile?.name}</Text>,
                disabled: true
            },
            {
                key: 'role',
                label: <Text type="secondary">{profile?.role}</Text>,
                disabled: true
            },
            {
                type: 'divider',
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
            key: '/indent',
            icon: <FileTextOutlined />,
            label: 'Indent',
        },
        {
            key: '/routine-summary',
            icon: <PushpinOutlined />,
            label: 'Draft Summary',
        },
        {
            key: '/shortexp',
            icon: <WarningOutlined />,
            label: 'Kew.PS-6',
        },
        {
            key: '/settings',
            icon: <SettingOutlined />,
            label: 'Settings',
        },
    ];

    // Inject Issuer-only menus before settings
    if (isIssuer) {
        menuItems.splice(2, 0,
            {
                key: '/cart',
                icon: <ShoppingCartOutlined />,
                label: 'Cart',
            },
            {
                key: '/indent-list',
                icon: <HistoryOutlined />,
                label: 'Records',
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
                        background: 'linear-gradient(to right, #ff9966 0%, #ff5e62 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        textTransform: 'uppercase',
                        fontSize: '26px',
                        fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
                    }}>
                        OPDHS v2
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
                        ROA OPD<br />Hosp Segamat
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
                        fontWeight: 400,
                        background: 'linear-gradient(to right, #ff9966 0%, #ff5e62 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        textTransform: 'uppercase',
                        fontSize: '24px',
                        fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
                    }}>
                        OPDHS
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
                        ROA OPD<br />Hosp Segamat
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
                            {menuItems.find(item => item.key === location.pathname)?.label || 'OPD-HS'}
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
