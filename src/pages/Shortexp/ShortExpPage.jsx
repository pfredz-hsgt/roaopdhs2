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
    Button
} from 'antd';
import {
    CalendarOutlined,
    WarningOutlined,
    FileExcelOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import { getSourceColor } from '../../lib/colorMappings';

const { Title, Text } = Typography;

const ShortExpPage = () => {
    const [loading, setLoading] = useState(true);
    const [drugs, setDrugs] = useState([]);
    const saveTimeouts = useRef({});

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
                        indent_source: invItem.indent_source,
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
                        indent_source: invItem.indent_source,
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

    const getQtyForColumn = (record, targetMonth) => {
        const today = dayjs().startOf('month');
        const exp = dayjs(record.exp_date).startOf('month');
        let diffMonths = exp.diff(today, 'month');

        if (diffMonths < 1) diffMonths = 1;

        return diffMonths === targetMonth ? record.qty : null;
    };

    const exportToExcel = () => {
        const wsData = [
            ['Drug Name', 'Purchase Type', 'Std Kt', 'Indent Source', 'Batch No', 'Expiry Date', '6M', '5M', '4M', '3M', '2M', '1M', 'Remarks'],
            ...drugs.map(item => {
                const qty6 = getQtyForColumn(item, 6);
                const qty5 = getQtyForColumn(item, 5);
                const qty4 = getQtyForColumn(item, 4);
                const qty3 = getQtyForColumn(item, 3);
                const qty2 = getQtyForColumn(item, 2);
                const qty1 = getQtyForColumn(item, 1);

                return [
                    item.name || '',
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
            { wch: 40 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 12 },
            { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 },
            { wch: 30 }
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Short Expiry");

        const filename = `Short_Expiry_Indent_${dayjs().format('YYYY-MM-DD')}.xlsx`;
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
            width: 120,
            render: (date) => (
                <Space>
                    <CalendarOutlined style={{ color: '#fa8c16' }} />
                    <Text>{dayjs(date).format('DD/MM/YYYY')}</Text>
                </Space>
            ),
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <Title level={3}>
                            <Space>
                                <WarningOutlined style={{ color: '#fa8c16' }} />
                                Short Expiry Items (Kew.PS-6)
                            </Space>
                        </Title>
                        <Text type="secondary">
                            Kew.PS-6 for Outpatient Pharmacy Counter.
                        </Text>
                    </div>
                    <Space>
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
                        pagination={{ pageSize: 20 }}
                    />
                </Card>
            </Space>
        </div>
    );
};

export default ShortExpPage;

