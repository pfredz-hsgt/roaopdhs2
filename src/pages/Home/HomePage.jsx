import React, { useState, useEffect } from 'react';
import { Typography, Card, Button, Form, Select, Spin, message, Row, Col } from 'antd';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { RocketOutlined, AuditOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;

const HomePage = () => {
    const { profile } = useAuth();
    const navigate = useNavigate();
    const [raks, setRaks] = useState([]);
    const [loadingRaks, setLoadingRaks] = useState(true);

    useEffect(() => {
        const fetchRaks = async () => {
            const { data, error } = await supabase
                .from('inventory_items')
                .select('row')
                .eq('indent_source', 'OPD Substor')
                .not('row', 'is', null);

            if (error) {
                console.error("Error fetching raks", error);
                message.error("Failed to load Raks");
            } else {
                // Extract unique raks
                const uniqueRaks = [...new Set(data.map(item => item.row))].sort();
                setRaks(uniqueRaks);
            }
            setLoadingRaks(false);
        };

        fetchRaks();
    }, []);

    const handleStartRoutine = (values) => {
        if (!values.rak) {
            message.warning("Please select a Rak first!");
            return;
        }
        navigate(`/routine-indent?rak=${encodeURIComponent(values.rak)}`);
    };

    return (
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
            <div style={{ marginBottom: 32, textAlign: 'center' }}>
                <Title level={2}>Welcome, {profile?.name}</Title>
                <Text type="secondary">Select an indenting mode to begin</Text>
            </div>

            <Row gutter={[24, 24]}>
                <Col xs={24} md={12}>
                    <Card
                        hoverable
                        title={<><AuditOutlined style={{ color: '#1890ff', marginRight: 8 }} /> Routine Indent</>}
                        style={{ height: '100%' }}
                        styles={{ body: { display: 'flex', flexDirection: 'column', height: 'calc(100% - 58px)' } }}
                    >
                        <Text style={{ display: 'block', marginBottom: 24 }}>
                            Systematic indenting for specific Raks in the OPD Substore.
                            You will review items one by one.
                        </Text>

                        <div style={{ marginTop: 'auto' }}>
                            {loadingRaks ? (
                                <Spin />
                            ) : (
                                <Form layout="vertical" onFinish={handleStartRoutine}>
                                    <Form.Item
                                        name="rak"
                                        label="Select Rak"
                                        rules={[{ required: true, message: 'Please select a Rak' }]}
                                    >
                                        <Select placeholder="Choose a Rak">
                                            {raks.map(rak => (
                                                <Option key={rak} value={rak}>{rak}</Option>
                                            ))}
                                        </Select>
                                    </Form.Item>
                                    <Button type="primary" htmlType="submit" block>
                                        Start Routine Indent
                                    </Button>
                                </Form>
                            )}
                        </div>
                    </Card>
                </Col>

                <Col xs={24} md={12}>
                    <Card
                        hoverable
                        title={<><RocketOutlined style={{ color: '#faad14', marginRight: 8 }} /> Urgent / Ad-Hoc Indent</>}
                        style={{ height: '100%' }}
                        styles={{ body: { display: 'flex', flexDirection: 'column', height: 'calc(100% - 58px)' } }}
                    >
                        <Text style={{ display: 'block', marginBottom: 24 }}>
                            Directly indent any specific item from the inventory without going through the standard routine.
                        </Text>
                        <div style={{ marginTop: 'auto' }}>
                            <Button type="default" block onClick={() => navigate('/indent')}>
                                Go to Urgent Indent
                            </Button>
                        </div>
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default HomePage;
