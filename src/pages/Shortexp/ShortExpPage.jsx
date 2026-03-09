import React, { useState, useEffect, useCallback } from 'react';
import {
    Space,
    Typography,
    Table,
    Tag,
    message,
    Skeleton,
    Empty,
    List
} from 'antd';
import {
    CalendarOutlined,
    EnvironmentOutlined,
    WarningOutlined,
    FieldTimeOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { supabase } from '../../lib/supabase';
import IndentModal from '../Indent/IndentModal';
import { getSourceColor } from '../../lib/colorMappings';

const { Title, Text } = Typography;

const ShortExpPage = () => {
    const [loading, setLoading] = useState(true);
    const [drugs, setDrugs] = useState([]);
    const [selectedDrug, setSelectedDrug] = useState(null);
    const [modalVisible, setModalVisible] = useState(false);

    useEffect(() => {
        fetchShortExpDrugs();
    }, []);

    const fetchShortExpDrugs = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('inventory_items')
                .select('*')
                .eq('is_short_exp', true)
                .not('short_exp', 'is', null);

            if (error) throw error;

            if (data) {
                // Sort by short_exp date ascending (shortest expiry first)
                data.sort((a, b) => {
                    const dateA = dayjs(a.short_exp);
                    const dateB = dayjs(b.short_exp);
                    return dateA.diff(dateB);
                });
            }

            setDrugs(data || []);
        } catch (error) {
            console.error('Error fetching short expiry items:', error);
            message.error('Failed to load short expiry items');
        } finally {
            setLoading(false);
        }
    };

    const handleRowClick = (record) => {
        setSelectedDrug(record);
        setModalVisible(true);
    };

    const handleModalClose = (shouldRefresh) => {
        setModalVisible(false);
        if (shouldRefresh) {
            fetchShortExpDrugs();
        }
    };

    const columns = [
        {
            title: 'Drug Name',
            dataIndex: 'name',
            key: 'name',
            render: (text, record) => (
                <Space direction="vertical" size={2}>
                    <Text strong>{text}</Text>
                    <Space size="small">
                        {record.puchase_type && <Tag color="blue" style={{ fontSize: '10px' }}>{record.puchase_type}</Tag>}
                        {record.std_kt && <Tag color="green" style={{ fontSize: '10px' }}>{record.std_kt}</Tag>}
                        {record.indent_source && (
                            <Tag color={getSourceColor(record.indent_source)} style={{ fontSize: '10px' }}>{record.indent_source}</Tag>
                        )}
                    </Space>
                </Space>
            ),
        },
        {
            title: 'Row',
            dataIndex: 'row',
            key: 'row',
            render: (text) => text && <Text>{text}</Text>,
            responsive: ['sm'],
        },
        {
            title: 'Expiry Date',
            dataIndex: 'short_exp',
            key: 'short_exp',
            render: (date) => (
                <Space>
                    <CalendarOutlined style={{ color: '#fa8c16' }} />
                    <Text>{dayjs(date).format('DD/MM/YYYY')}</Text>
                </Space>
            ),
        },
        {
            title: 'Days Left',
            key: 'days_left',
            render: (_, record) => {
                const today = dayjs().startOf('day');
                const expDate = dayjs(record.short_exp).startOf('day');
                const daysLeft = expDate.diff(today, 'day');

                let color = 'green';
                if (daysLeft < 30) color = 'red';
                else if (daysLeft < 90) color = 'orange';

                return (
                    <Tag color={color} icon={<FieldTimeOutlined />}>
                        {daysLeft} days
                    </Tag>
                );
            },
            defaultSortOrder: 'ascend',
            sorter: (a, b) => {
                const daysA = dayjs(a.short_exp).diff(dayjs(), 'day');
                const daysB = dayjs(b.short_exp).diff(dayjs(), 'day');
                return daysA - daysB;
            },
        },
    ];

    return (
        <div>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {/* Header */}
                <div>
                    <Title level={3}>
                        <Space>
                            <WarningOutlined style={{ color: '#fa8c16' }} />
                            Short Expiry Items
                        </Space>
                    </Title>
                    <Text type="secondary">
                        Items flagged as short expiry, sorted by urgency
                    </Text>
                </div>

                {/* Content */}
                {loading ? (
                    <Skeleton active />
                ) : drugs.length === 0 ? (
                    <Empty description="No short expiry items found" />
                ) : (
                    <List
                        grid={{
                            gutter: 16,
                            xs: 1,
                            sm: 1,
                            md: 2,
                            lg: 2,
                            xl: 3,
                            xxl: 3,
                        }}
                        dataSource={drugs}
                        renderItem={(drug) => {
                            const today = dayjs().startOf('day');
                            const expDate = dayjs(drug.short_exp).startOf('day');
                            const daysLeft = expDate.diff(today, 'day');

                            let daysColor = 'green';
                            if (daysLeft < 30) daysColor = 'red';
                            else if (daysLeft < 90) daysColor = 'orange';

                            const isCritical = daysLeft < 30;

                            return (
                                <List.Item>
                                    <div
                                        onClick={() => handleRowClick(drug)}
                                        style={{
                                            border: `1px solid ${isCritical ? '#ff4d4f' : '#f0f0f0'}`,
                                            borderRadius: '8px',
                                            padding: '16px',
                                            cursor: 'pointer',
                                            background: '#fff',
                                            transition: 'all 0.3s',
                                            position: 'relative',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '12px',
                                            boxShadow: isCritical ? '0 0 10px rgba(255, 77, 79, 0.5)' : 'none',
                                        }}
                                        onMouseEnter={(e) => {
                                            if (isCritical) {
                                                e.currentTarget.style.boxShadow = '0 0 15px rgba(255, 77, 79, 0.7)';
                                            } else {
                                                e.currentTarget.style.borderColor = '#1890ff';
                                                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (isCritical) {
                                                e.currentTarget.style.borderColor = '#ff4d4f';
                                                e.currentTarget.style.boxShadow = '0 0 10px rgba(255, 77, 79, 0.5)';
                                            } else {
                                                e.currentTarget.style.borderColor = '#f0f0f0';
                                                e.currentTarget.style.boxShadow = 'none';
                                            }
                                        }}
                                    >
                                        {/* Header: Name and Days Left Badge */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                            <div style={{ flex: 1 }}>
                                                <Text strong style={{ fontSize: '16px', lineHeight: 1.2, display: 'block', marginBottom: '4px' }}>
                                                    {drug.name}
                                                </Text>
                                                <Space size={[4, 4]} wrap>
                                                    {drug.puchase_type && <Tag color="blue" style={{ margin: 0, fontSize: '10px' }}>{drug.puchase_type}</Tag>}
                                                    {drug.std_kt && <Tag color="green" style={{ margin: 0, fontSize: '10px' }}>{drug.std_kt}</Tag>}
                                                    {drug.indent_source && (
                                                        <Tag color={getSourceColor(drug.indent_source)} style={{ margin: 0, fontSize: '10px' }}>{drug.indent_source}</Tag>
                                                    )}
                                                </Space>
                                            </div>
                                            <Tag color={daysColor} style={{ margin: 0, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <FieldTimeOutlined /> {daysLeft}d
                                            </Tag>
                                        </div>

                                        {/* Details */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'rgba(0, 0, 0, 0.45)' }}>
                                            {drug.row && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <EnvironmentOutlined style={{ color: '#1890ff' }} />
                                                    <Text type="secondary">Row: {drug.row}</Text>
                                                </div>
                                            )}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <CalendarOutlined style={{ color: '#fa8c16' }} />
                                                <Space>
                                                    <Text type="secondary">Expires:</Text>
                                                    <Text strong>{dayjs(drug.short_exp).format('DD MMM YYYY')}</Text>
                                                </Space>
                                            </div>
                                        </div>
                                    </div>
                                </List.Item>
                            );
                        }}
                    />
                )}
            </Space>

            <IndentModal
                drug={selectedDrug}
                visible={modalVisible}
                onClose={handleModalClose}
                onSuccess={() => {
                    message.success('Request processed');
                    setModalVisible(false);
                }}
                onDrugUpdate={fetchShortExpDrugs}
            />
        </div>
    );
};

export default ShortExpPage;
