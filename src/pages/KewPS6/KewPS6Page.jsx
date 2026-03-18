import React, { useState, useEffect, useRef } from 'react';
import { Table, Typography, Card, InputNumber, Input, Spin, message, Button, Space, DatePicker, Tag } from 'antd';
import { supabase } from '../../lib/supabase';
import { FileExcelOutlined, SaveOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';

const { Title, Text } = Typography;

const KewPS6Page = () => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState([]);
    const [savingId, setSavingId] = useState(null);
    const saveTimeouts = useRef({});

    useEffect(() => {
        fetchKewPS6Records();
    }, []);

    const fetchKewPS6Records = async () => {
        setLoading(true);
        try {
            const { data: records, error } = await supabase
                .from('kewps6_records')
                .select(`
                    *,
                    inventory_items(name)
                `)
                .order('exp_date', { ascending: true });

            if (error) throw error;
            setData(records || []);
        } catch (error) {
            console.error(error);
            message.error("Failed to load Kew.PS-6 data");
        } finally {
            setLoading(false);
        }
    };

    // Auto-save function with debounce
    const handleFieldChange = (recordId, field, value) => {
        // Update local state immediately for snappy UI
        setData(prevData => prevData.map(item =>
            item.id === recordId ? { ...item, [field]: value } : item
        ));

        // Clear existing timeout for this record if any
        if (saveTimeouts.current[recordId]) {
            clearTimeout(saveTimeouts.current[recordId]);
        }

        // Set a new timeout to save to DB after 800ms of inactivity
        saveTimeouts.current[recordId] = setTimeout(() => {
            saveToDatabase(recordId, field, value);
        }, 800);
    };

    const saveToDatabase = async (recordId, field, value) => {
        setSavingId(recordId);
        try {
            const { error } = await supabase
                .from('kewps6_records')
                .update({ [field]: value })
                .eq('id', recordId);

            if (error) throw error;
            // Optionally could show a subtle toast, but can be noisy
            // message.success('Saved');
        } catch (error) {
            console.error(`Failed to save ${field}:`, error);
            message.error("Failed to save changes!");
        } finally {
            setSavingId(null);
        }
    };

    const exportToExcel = () => {
        const wsData = [
            ['Item Name', 'Batch No', 'Exp Date', '6 Bulan', '5 Bulan', '4 Bulan', '3 Bulan', '2 Bulan', '1 Bulan', 'Catatan'],
            ...data.map(item => [
                item.inventory_items?.name || '',
                item.batch_no || '',
                item.exp_date ? dayjs(item.exp_date).format('DD/MM/YYYY') : '',
                item.qty_6m || 0,
                item.qty_5m || 0,
                item.qty_4m || 0,
                item.qty_3m || 0,
                item.qty_2m || 0,
                item.qty_1m || 0,
                item.se_remarks || ''
            ])
        ];

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        ws['!cols'] = [
            { wch: 40 }, { wch: 15 }, { wch: 12 },
            { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
            { wch: 30 }
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "KEW.PS-6");

        const filename = `KEW_PS6_${dayjs().format('YYYY-MM-DD')}.xlsx`;
        XLSX.writeFile(wb, filename);
    };

    // Calculate months until expiry for coloring
    const getExpGlowColor = (expDate) => {
        if (!expDate) return null;
        const monthsDiff = dayjs(expDate).diff(dayjs(), 'month', true);
        if (monthsDiff <= 1) return '#fff1f0'; // Red
        if (monthsDiff <= 3) return '#fff7e6'; // Orange
        if (monthsDiff <= 6) return '#fcffe6'; // Yellow/Green
        return null;
    };

    const columns = [
        {
            title: 'Item Name',
            dataIndex: ['inventory_items', 'name'],
            key: 'name',
            width: 280,
            fixed: 'left',
            render: (text) => <Text strong>{text}</Text>
        },
        {
            title: 'Batch No',
            dataIndex: 'batch_no',
            key: 'batch_no',
            width: 120,
            render: (text) => <Tag color="blue">{text}</Tag>
        },
        {
            title: 'Exp Date',
            dataIndex: 'exp_date',
            key: 'exp_date',
            width: 120,
            render: (text) => text ? dayjs(text).format('DD/MM/YYYY') : '-'
        },
        {
            title: '6M',
            dataIndex: 'qty_6m',
            width: 80,
            render: (val, record) => (
                <InputNumber min={0} value={val} size="small" style={{ width: 60 }} inputMode="numeric" onChange={v => handleFieldChange(record.id, 'qty_6m', v)} />
            )
        },
        {
            title: '5M',
            dataIndex: 'qty_5m',
            width: 80,
            render: (val, record) => (
                <InputNumber min={0} value={val} size="small" style={{ width: 60 }} inputMode="numeric" onChange={v => handleFieldChange(record.id, 'qty_5m', v)} />
            )
        },
        {
            title: '4M',
            dataIndex: 'qty_4m',
            width: 80,
            render: (val, record) => (
                <InputNumber min={0} value={val} size="small" style={{ width: 60 }} inputMode="numeric" onChange={v => handleFieldChange(record.id, 'qty_4m', v)} />
            )
        },
        {
            title: '3M',
            dataIndex: 'qty_3m',
            width: 80,
            render: (val, record) => (
                <InputNumber min={0} value={val} size="small" style={{ width: 60 }} inputMode="numeric" onChange={v => handleFieldChange(record.id, 'qty_3m', v)} />
            )
        },
        {
            title: '2M',
            dataIndex: 'qty_2m',
            width: 80,
            render: (val, record) => (
                <InputNumber min={0} value={val} size="small" style={{ width: 60 }} inputMode="numeric" onChange={v => handleFieldChange(record.id, 'qty_2m', v)} />
            )
        },
        {
            title: '1M',
            dataIndex: 'qty_1m',
            width: 80,
            render: (val, record) => (
                <InputNumber min={0} value={val} size="small" style={{ width: 60 }} inputMode="numeric" onChange={v => handleFieldChange(record.id, 'qty_1m', v)} />
            )
        },
        {
            title: 'Remarks',
            dataIndex: 'se_remarks',
            key: 'se_remarks',
            render: (val, record) => (
                <Input
                    value={val}
                    placeholder="Catatan..."
                    bordered={false}
                    style={{ borderBottom: '1px dashed #d9d9d9' }}
                    onChange={e => handleFieldChange(record.id, 'se_remarks', e.target.value)}
                />
            )
        }
    ];

    if (loading) return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <Title level={3} style={{ margin: 0 }}>KEW.PS-6 (Short Expiry)</Title>
                    <Text type="secondary">Monitor and manage nearly expired items interactively.</Text>
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

            <Card bodyStyle={{ padding: 0 }}>
                <Table
                    columns={columns}
                    dataSource={data}
                    rowKey="id"
                    scroll={{ x: 1200, y: 600 }}
                    pagination={false}
                    rowClassName={(record) => {
                        const bg = getExpGlowColor(record.exp_date);
                        return bg ? `bg-glow-${record.id}` : '';
                    }}
                />
            </Card>

            {/* Inject dynamic styles for row background colors without CSS modules */}
            <style>{`
                ${data.map(r => {
                const bg = getExpGlowColor(r.exp_date);
                return bg ? `.bg-glow-${r.id} td { background-color: ${bg} !important; }` : '';
            }).join('\n')}
            `}</style>
        </div>
    );
};

export default KewPS6Page;
