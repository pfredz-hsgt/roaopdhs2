import React, { useState, useEffect, useRef } from 'react';
import {
    Space,
    Typography,
    Table,
    Tag,
    message,
    Input,
    Card,
    Spin,
    Button,
    Modal,
    Form,
    Popconfirm,
    Row,
    Col,
    DatePicker,
    InputNumber
} from 'antd';
import {
    CalendarOutlined,
    WarningOutlined,
    FileExcelOutlined,
    MoreOutlined,
    DeleteOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import { getSourceColor } from '../../lib/colorMappings';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

const ShortExpPage = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [drugs, setDrugs] = useState([]);
    const saveTimeouts = useRef({});

    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [editingRecord, setEditingRecord] = useState(null);
    const [form] = Form.useForm();

    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);

    const handlePageChange = (page, newPageSize) => {
        setCurrentPage(page);
        if (newPageSize !== pageSize) {
            setPageSize(newPageSize);
        }
    };

    useEffect(() => {
        fetchShortExpDrugs();
    }, []);

    const fetchShortExpDrugs = async () => {
        try {
            setLoading(true);

            // 1. Fetch indent_items that have short exp data
            const { data: indentData, error: indentError } = await supabase
                .from('indent_items')
                .select(`*, inventory_items(*)`)
                .or('batch_no_1.not.is.null,batch_no_2.not.is.null');

            if (indentError) throw indentError;

            // 2. Fetch all kewps6_records to get se_remarks
            const { data: kewps6Data, error: kewps6Error } = await supabase
                .from('kewps6_records')
                .select('item_id, batch_no, se_remarks');

            if (kewps6Error) throw kewps6Error;

            // Map remarks by item_id + batch_no
            const remarksMap = {};
            kewps6Data?.forEach(record => {
                const key = `${record.item_id}_${record.batch_no}`;
                remarksMap[key] = record.se_remarks;
            });

            // 3. Normalize into single rows per batch
            const rows = [];

            indentData?.forEach(item => {
                const invItem = item.inventory_items || {};

                if (item.batch_no_1 && item.exp_date_1) {
                    const key = `${item.item_id}_${item.batch_no_1}`;
                    rows.push({
                        id: `${item.id}_b1`,
                        original_id: item.id,
                        item_id: item.item_id,
                        name: invItem.name,
                        puchase_type: invItem.puchase_type,
                        std_kt: invItem.std_kt,
                        pku: invItem.pku,
                        indent_source: invItem.indent_source,
                        rak: invItem.row,
                        batch_no: item.batch_no_1,
                        exp_date: item.exp_date_1,
                        qty: item.short_qty_1 || 0,
                        se_remarks: remarksMap[key] || '',
                    });
                }

                if (item.batch_no_2 && item.exp_date_2) {
                    const key = `${item.item_id}_${item.batch_no_2}`;
                    rows.push({
                        id: `${item.id}_b2`,
                        original_id: item.id,
                        item_id: item.item_id,
                        name: invItem.name,
                        puchase_type: invItem.puchase_type,
                        std_kt: invItem.std_kt,
                        pku: invItem.pku,
                        indent_source: invItem.indent_source,
                        rak: invItem.row,
                        batch_no: item.batch_no_2,
                        exp_date: item.exp_date_2,
                        qty: item.short_qty_2 || 0,
                        se_remarks: remarksMap[key] || '',
                    });
                }
            });

            // Sort by exp_date
            rows.sort((a, b) => dayjs(a.exp_date).diff(dayjs(b.exp_date)));

            setDrugs(rows);
        } catch (error) {
            console.error('Error fetching short expiry items:', error);
            message.error('Failed to load short expiry items');
        } finally {
            setLoading(false);
        }
    };

    const handleRemarkChange = (record, value) => {
        // Optimistic UI Update
        setDrugs(prev => prev.map(item =>
            item.id === record.id ? { ...item, se_remarks: value } : item
        ));

        if (saveTimeouts.current[record.id]) {
            clearTimeout(saveTimeouts.current[record.id]);
        }

        saveTimeouts.current[record.id] = setTimeout(() => {
            saveToDatabase(record, value);
        }, 800);
    };

    const saveToDatabase = async (record, value) => {
        try {
            // Check if exist
            const { data, error: fetchErr } = await supabase
                .from('kewps6_records')
                .select('id')
                .eq('item_id', record.item_id)
                .eq('batch_no', record.batch_no)
                .maybeSingle();

            if (fetchErr) throw fetchErr;

            if (data) {
                // Update
                const { error: updErr } = await supabase
                    .from('kewps6_records')
                    .update({ se_remarks: value })
                    .eq('id', data.id);
                if (updErr) throw updErr;
            } else {
                // Insert
                const today = dayjs().startOf('month');
                const exp = dayjs(record.exp_date).startOf('month');
                let m = exp.diff(today, 'month');
                if (m < 1) m = 1;

                const targetColumn = m <= 6 ? `qty_${m}m` : null;

                const insertData = {
                    item_id: record.item_id,
                    batch_no: record.batch_no,
                    exp_date: record.exp_date,
                    se_remarks: value
                };

                if (targetColumn) {
                    insertData[targetColumn] = record.qty;
                }

                const { error: insErr } = await supabase
                    .from('kewps6_records')
                    .insert(insertData);

                if (insErr) throw insErr;
            }
        } catch (error) {
            console.error('Failed to save remark:', error);
            message.error("Failed to save remark!");
        }
    };

    const openEditModal = (record) => {
        setEditingRecord(record);
        form.setFieldsValue({
            batch_no: record.batch_no,
            exp_date: record.exp_date ? dayjs(record.exp_date) : null,
            qty: record.qty,
            se_remarks: record.se_remarks
        });
        setIsEditModalVisible(true);
    };

    const handleEditModalCancel = () => {
        setIsEditModalVisible(false);
        setEditingRecord(null);
        form.resetFields();
    };

    const handleEditSubmit = async (values) => {
        try {
            const isB1 = editingRecord.id.endsWith('_b1');
            const expDateStr = values.exp_date ? values.exp_date.format('YYYY-MM-DD') : null;

            // Update indent_items for batch_no, exp_date, short_qty
            const indentUpdate = isB1 ? {
                batch_no_1: values.batch_no,
                exp_date_1: expDateStr,
                short_qty_1: values.qty
            } : {
                batch_no_2: values.batch_no,
                exp_date_2: expDateStr,
                short_qty_2: values.qty
            };

            const { error: indentError } = await supabase
                .from('indent_items')
                .update(indentUpdate)
                .eq('id', editingRecord.original_id);

            if (indentError) throw indentError;

            // Update kewps6_records for se_remarks
            if (values.se_remarks !== undefined) {
                await saveToDatabase({
                    item_id: editingRecord.item_id,
                    batch_no: values.batch_no,
                    exp_date: expDateStr,
                    qty: values.qty
                }, values.se_remarks);
            }

            message.success('Record updated successfully');
            setIsEditModalVisible(false);
            setEditingRecord(null);
            fetchShortExpDrugs();
        } catch (error) {
            console.error('Error updating record:', error);
            message.error('Failed to update record');
        }
    };

    const handleDelete = async (record) => {
        try {
            const isB1 = record.id.endsWith('_b1');
            const indentUpdate = isB1 ? {
                batch_no_1: null,
                exp_date_1: null,
                short_qty_1: null
            } : {
                batch_no_2: null,
                exp_date_2: null,
                short_qty_2: null
            };

            const { error: indentError } = await supabase
                .from('indent_items')
                .update(indentUpdate)
                .eq('id', record.original_id);

            if (indentError) throw indentError;

            message.success('Record deleted successfully');
            fetchShortExpDrugs();
        } catch (error) {
            console.error('Error deleting record:', error);
            message.error('Failed to delete record');
        }
    };

    const getQtyForColumn = (record, targetMonth) => {
        const today = dayjs().startOf('month');
        const exp = dayjs(record.exp_date).startOf('month');
        let diffMonths = exp.diff(today, 'month');

        if (diffMonths < 1) diffMonths = 1;

        return diffMonths === targetMonth ? record.qty : null;
    };

    const exportToExcel = () => {
        const wsData = [
            ['Drug Name', 'PKU', 'Purchase Type', 'Std Kt', 'Indent Source', 'Batch No', 'Expiry Date', '6M', '5M', '4M', '3M', '2M', '1M', 'Remarks'],
            ...drugs.map(item => {
                const qty6 = getQtyForColumn(item, 6);
                const qty5 = getQtyForColumn(item, 5);
                const qty4 = getQtyForColumn(item, 4);
                const qty3 = getQtyForColumn(item, 3);
                const qty2 = getQtyForColumn(item, 2);
                const qty1 = getQtyForColumn(item, 1);

                return [
                    item.name || '',
                    item.pku || '',
                    item.puchase_type || '',
                    item.std_kt || '',
                    item.indent_source || '',
                    item.batch_no || '',
                    item.exp_date ? dayjs(item.exp_date).format('DD/MM/YYYY') : '',
                    qty6 !== null ? qty6 : '-',
                    qty5 !== null ? qty5 : '-',
                    qty4 !== null ? qty4 : '-',
                    qty3 !== null ? qty3 : '-',
                    qty2 !== null ? qty2 : '-',
                    qty1 !== null ? qty1 : '-',
                    item.se_remarks || ''
                ];
            })
        ];

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        ws['!cols'] = [
            { wch: 40 }, { wch: 15 }, { wch: 5 }, { wch: 5 }, { wch: 15 }, { wch: 15 }, { wch: 12 },
            { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 },
            { wch: 30 }
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Short Expiry");

        const filename = `Kew.PS-6_${dayjs().format('YYYYMMDD')}.xlsx`;
        XLSX.writeFile(wb, filename);
    };

    const columns = [
        {
            title: 'Drug Name',
            dataIndex: 'name',
            key: 'name',
            width: 250,
            fixed: 'left',
            render: (text, record) => (
                <Space direction="vertical" size={2}>
                    <Text strong>{text}</Text>
                    <Space size="small" wrap>
                        {record.pku && <Tag color="magenta" style={{ fontSize: '12px' }}>{record.pku}</Tag>}
                        {record.puchase_type && <Tag color="blue" style={{ fontSize: '10px' }}>{record.puchase_type}</Tag>}
                        {record.std_kt && <Tag color="green" style={{ fontSize: '10px' }}>{record.std_kt}</Tag>}
                        {record.rak && <Tag color="blue" style={{ fontSize: '10px' }}>Rak: {record.rak}</Tag>}
                        {record.indent_source && (
                            <Tag color={getSourceColor(record.indent_source)} style={{ fontSize: '10px' }}>{record.indent_source}</Tag>
                        )}
                    </Space>
                </Space>
            ),
        },
        {
            title: 'Batch No',
            dataIndex: 'batch_no',
            key: 'batch_no',
            width: 120,
            render: (text) => <Tag color="geekblue">{text}</Tag>
        },
        {
            title: 'Expiry Date',
            dataIndex: 'exp_date',
            key: 'exp_date',
            width: 130,
            render: (date) => {
                const daysLeft = dayjs(date).startOf('day').diff(dayjs().startOf('day'), 'day');
                const isUrgent = daysLeft < 30;
                return (
                    <Space direction="vertical" size={0} align="center">
                        <Space>
                            <CalendarOutlined style={{ color: '#fa8c16' }} />
                            <Text>{dayjs(date).format('DD/MM/YYYY')}</Text>
                        </Space>
                        <Text style={{ color: isUrgent ? 'red' : 'inherit', fontSize: '12px' }}>
                            ({daysLeft} Days)
                        </Text>
                    </Space>
                );
            },
        },
        {
            title: '6M',
            key: '6m',
            width: 70,
            align: 'center',
            render: (_, record) => {
                const qty = getQtyForColumn(record, 6);
                return qty !== null ? <Text strong>{qty}</Text> : '-';
            }
        },
        {
            title: '5M',
            key: '5m',
            width: 70,
            align: 'center',
            render: (_, record) => {
                const qty = getQtyForColumn(record, 5);
                return qty !== null ? <Text strong>{qty}</Text> : '-';
            }
        },
        {
            title: '4M',
            key: '4m',
            width: 70,
            align: 'center',
            render: (_, record) => {
                const qty = getQtyForColumn(record, 4);
                return qty !== null ? <Text strong>{qty}</Text> : '-';
            }
        },
        {
            title: '3M',
            key: '3m',
            width: 70,
            align: 'center',
            render: (_, record) => {
                const qty = getQtyForColumn(record, 3);
                return qty !== null ? <Text strong>{qty}</Text> : '-';
            }
        },
        {
            title: '2M',
            key: '2m',
            width: 70,
            align: 'center',
            render: (_, record) => {
                const qty = getQtyForColumn(record, 2);
                return qty !== null ? <Text strong style={{ color: '#fa8c16' }}>{qty}</Text> : '-';
            }
        },
        {
            title: '1M',
            key: '1m',
            width: 70,
            align: 'center',
            render: (_, record) => {
                const qty = getQtyForColumn(record, 1);
                return qty !== null ? <Text strong style={{ color: '#f5222d' }}>{qty}</Text> : '-';
            }
        },
        {
            title: 'Remarks',
            dataIndex: 'se_remarks',
            key: 'se_remarks',
            width: 250,
            render: (val, record) => (
                <Input
                    value={val}
                    placeholder="E.g. dispose, offered to other tech..."
                    bordered={false}
                    style={{ borderBottom: '1px dashed #d9d9d9', background: 'transparent' }}
                    onChange={e => handleRemarkChange(record, e.target.value)}
                />
            )
        }
    ];

    if (loading) {
        return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>;
    }

    return (
        <div>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {/* Header */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <Title level={3} style={{ margin: 0, marginBottom: 8 }}>
                            <Space>
                                <WarningOutlined style={{ color: '#fa8c16' }} />
                                Short Expiry Items (Kew.PS-6)
                            </Space>
                        </Title>
                        <Text type="secondary">
                            Kew.PS-6 for Outpatient Pharmacy Counter.
                        </Text>
                    </div>
                    <Space wrap>
                        <Button type="primary" onClick={() => navigate('/shortexp-entry')}>
                            Record Entry
                        </Button>
                        <Button
                            icon={<FileExcelOutlined />}
                            onClick={exportToExcel}
                            style={{ backgroundColor: '#217346', borderColor: '#217346', color: '#fff' }}
                        >
                            Export Excel
                        </Button>
                    </Space>
                </div>

                {/* Content */}
                <Card bodyStyle={{ padding: 0 }}>
                    <Table
                        columns={columns}
                        dataSource={drugs}
                        rowKey="id"
                        scroll={{ x: 1200 }}
                        pagination={{
                            current: currentPage,
                            pageSize: pageSize,
                            total: drugs.length,
                            onChange: handlePageChange,
                            showSizeChanger: true,
                            showTotal: (total) => `Total ${total} items`,
                            pageSizeOptions: ['25', '50', '100', '200'],
                        }}
                        onRow={(record) => ({
                            onClick: () => {
                                openEditModal(record);
                            },
                        })}
                        rowClassName={() => 'clickable-row'}
                    />
                </Card>
            </Space>

            <style>{`
                .clickable-row {
                    cursor: pointer;
                }
                .clickable-row:hover td {
                    background-color: #f5f5f5 !important;
                }
            `}</style>

            <Modal
                title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingRight: 24 }}>
                        <span>Edit Short Expiry Record</span>
                        <Popconfirm
                            title="Delete batch record?"
                            description="This will clear the batch info."
                            onConfirm={() => {
                                handleDelete(editingRecord);
                                setIsEditModalVisible(false);
                            }}
                            okText="Yes"
                            cancelText="No"
                            placement="bottomRight"
                        >
                            <Button type="text" danger icon={<DeleteOutlined />} onClick={e => e.stopPropagation()} />
                        </Popconfirm>
                    </div>
                }
                open={isEditModalVisible}
                onOk={() => form.submit()}
                onCancel={handleEditModalCancel}
                destroyOnClose
                closable={false}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleEditSubmit}
                >
                    <Form.Item label="Drug Name">
                        <Input
                            value={editingRecord?.name}
                            addonAfter={editingRecord?.pku ? `${editingRecord.pku}` : null}
                        />
                    </Form.Item>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item label="Batch No" name="batch_no" rules={[{ required: true, message: 'Please enter Batch No' }]}>
                                <Input />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="Expiry Date" name="exp_date" rules={[{ required: true, message: 'Please select Expiry Date' }]}>
                                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item label="Quantity (Short Expiry)" name="qty">
                        <InputNumber min={0} style={{ width: '100%' }} inputMode="numeric" />
                    </Form.Item>
                    <Form.Item label="Remarks" name="se_remarks">
                        <Input.TextArea rows={2} />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default ShortExpPage;

