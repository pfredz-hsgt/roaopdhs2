import React from 'react';
import { Card, Tag, Typography, Space } from 'antd';
import { getSourceColor } from '../lib/colorMappings';

const { Text } = Typography;

const DrugCard = ({ drug, onClick }) => {

    return (
        <Card
            hoverable
            onClick={onClick}
            style={{ marginBottom: 16 }}
        >
            <Card.Meta
                title={<Text strong>{drug.name}</Text>}
                description={
                    <div style={{ marginTop: 8 }}>
                        <Space wrap size={[4, 4]} style={{ marginBottom: 8 }}>
                            {drug.puchase_type && (
                                <Tag color="blue">{drug.puchase_type}</Tag>
                            )}
                            {drug.std_kt && (
                                <Tag color="green">{drug.std_kt}</Tag>
                            )}
                            {drug.indent_source && (
                                <Tag color={getSourceColor(drug.indent_source)}>{drug.indent_source}</Tag>
                            )}
                        </Space>
                        <div style={{ marginBottom: 4 }}>
                            {drug.item_code && (
                                <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>
                                    Code: <Text strong>{drug.item_code}</Text>
                                </Text>
                            )}
                            {drug.pku && (
                                <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>
                                    PKU: <Text strong>{drug.pku}</Text>
                                </Text>
                            )}
                            {drug.row && (
                                <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>
                                    Row: <Text strong>{drug.row}</Text>
                                </Text>
                            )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                            <Text type="secondary" style={{ fontSize: '12px' }}>
                                Max: <Text strong style={{ fontSize: '12px' }}>{drug.max_qty || 'N/A'}</Text>
                            </Text>
                            <Text type="secondary" style={{ fontSize: '12px' }}>
                                Balance: <Text strong style={{ fontSize: '12px' }}>{drug.balance || 'N/A'}</Text>
                            </Text>
                        </div>
                        {drug.remarks && (
                            <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: 4 }}>
                                {drug.remarks}
                            </Text>
                        )}
                    </div>
                }
            />
        </Card>
    );
};

export default DrugCard;
