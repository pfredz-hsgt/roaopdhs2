import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Typography,
    Space,
    Collapse,
    List,
    Tag,
    Button,
    Empty,
    Spin,
    message,
    Modal,
    Popconfirm,
    Checkbox,
} from 'antd';
import {
    HistoryOutlined,
    EyeOutlined,
    DownOutlined,
    DeleteOutlined,
    CheckCircleOutlined
} from '@ant-design/icons';
import { supabase } from '../../lib/supabase';
import { getPuchaseTypeColor, getStdKtColor } from '../../lib/colorMappings';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Panel } = Collapse;

const CartPage = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [sessions, setSessions] = useState([]);
    const [selectedSessions, setSelectedSessions] = useState([]);

    useEffect(() => {
        fetchCartSessions();
    }, []);

    const fetchCartSessions = async () => {
        try {
            setLoading(true);

            // Fetch sessions that are "Submitted" (Pending Issuer Action)
            const { data: sessionsData, error: sessionError } = await supabase
                .from('indent_sessions')
                .select(`
                    id, 
                    created_at, 
                    session_type,
                    rak,
                    profiles(name),
                    indent_items(*, inventory_items(*))
                `)
                .eq('status', 'Submitted')
                .order('created_at', { ascending: true });

            if (sessionError) throw sessionError;

            // Sort items inside each session alphabetically
            const processedSessions = (sessionsData || [])
                .map(sess => {
                    const sortedItems = [...sess.indent_items]
                        .filter(item => item.requested_qty > 0)
                        .sort((a, b) =>
                            (a.inventory_items?.name || '').localeCompare(b.inventory_items?.name || '')
                        );
                    return { ...sess, indent_items: sortedItems };
                })
                .filter(sess => sess.indent_items.length > 0);

            setSessions(processedSessions);
            setSelectedSessions(processedSessions.map(s => s.id));

        } catch (error) {
            console.error('Error fetching cart items:', error);
            message.error('Failed to load cart items');
        } finally {
            setLoading(false);
        }
    };

    const handleClearSession = async (sessionId) => {
        try {
            // Mark as Approved/Completed
            const { error } = await supabase
                .from('indent_sessions')
                .update({ status: 'Approved' })
                .eq('id', sessionId);

            if (error) throw error;

            message.success('Indent Session cleared successfully!');
            fetchCartSessions();
        } catch (error) {
            console.error('Error clearing indent:', error);
            message.error('Failed to clear indent');
        }
    };

    const generatePDFDocument = (session) => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        let yPosition = 15;

        // Header
        doc.setFontSize(8);
        doc.setFont(undefined, 'italic');
        doc.text('Pekeliling Perbendaharaan Malaysia', 7, yPosition);
        doc.setFont(undefined, 'normal');
        doc.text('AM 6.5 LAMPIRAN B', pageWidth / 2, yPosition, { align: 'center' });
        doc.text('KEW.PS-8', pageWidth - 7, yPosition, { align: 'right' });
        yPosition += 10;

        // Title
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        let title = `BORANG PERMOHONAN STOK UBAT (${session.session_type})`;
        if (session.rak) title += ` - RAK ${session.rak}`;
        doc.text(title, pageWidth / 2, yPosition, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        yPosition += 7;
        doc.text(`Pemohon: ${session.profiles?.name || 'Unknown'}`, 10, yPosition);
        doc.text(`Tarikh: ${dayjs(session.created_at).format('DD/MM/YYYY HH:mm')}`, pageWidth - 10, yPosition, { align: 'right' });
        yPosition += 5;

        const tableData = session.indent_items.map((item, idx) => [
            (idx + 1).toString(),
            (item.inventory_items?.name || '') + (item.inventory_items?.pku ? ` | ${item.inventory_items.pku}` : ''),
            item.requested_qty || 0,
            item.indent_remarks || '',
            '', // Kuantiti Diluluskan
            '', // Catatan
        ]);

        autoTable(doc, {
            startY: yPosition,
            head: [[
                { content: 'Bil', styles: { halign: 'center' } },
                { content: 'Perihal stok', styles: { halign: 'center' } },
                { content: 'Kuantiti \nDipohon', styles: { halign: 'center' } },
                { content: 'Catatan', styles: { halign: 'center' } },
                { content: 'Kuantiti \nDiluluskan', styles: { halign: 'center' } },
                { content: 'Catatan', styles: { halign: 'center' } },
            ]],
            body: tableData,
            theme: 'grid',
            styles: { fontSize: 10, cellPadding: 3 },
            headStyles: {
                fillColor: [255, 255, 255],
                textColor: [0, 0, 0],
                fontStyle: 'bold',
                lineWidth: 0.2,
                lineColor: [0, 0, 0],
            },
            bodyStyles: {
                lineWidth: 0.2,
                lineColor: [0, 0, 0],
                minCellHeight: 9,
            },
            columnStyles: {
                0: { cellWidth: 11, halign: 'center' },
                1: { cellWidth: 70 },
                2: { cellWidth: 25, halign: 'center' },
                3: { cellWidth: 32 },
                4: { cellWidth: 25, halign: 'center' },
                5: { cellWidth: 32 },
            },
            margin: { bottom: 50, left: 7, right: 7 },
            didDrawCell: function (data) {
                if (data.column.index === 4) {
                    doc.setLineWidth(0.8);
                    doc.line(data.cell.x, data.cell.y, data.cell.x, data.cell.y + data.cell.height);
                    doc.setLineWidth(0.2);
                }
            },
        });

        // Signatures
        const finalY = pageHeight - 50;
        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');

        const leftX = 15;
        doc.text('Pemohon', leftX, finalY);
        doc.text('(Tandatangan)', leftX, finalY + 15);
        doc.text('Nama : ' + (session.profiles?.name || ''), leftX, finalY + 20);
        doc.text('Tarikh :', leftX, finalY + 30);

        const middleX = pageWidth / 2 - 20;
        doc.text('Pegawai Pelulus', middleX, finalY);
        doc.text('(Tandatangan)', middleX, finalY + 15);
        doc.text('Nama :', middleX, finalY + 20);
        doc.text('Tarikh :', middleX, finalY + 30);

        const rightX = pageWidth - 60;
        doc.text('Penerima', rightX, finalY);
        doc.text('(Tandatangan)', rightX, finalY + 15);
        doc.text('Nama :  ', rightX, finalY + 20);
        doc.text('Tarikh :', rightX, finalY + 30);

        return doc;
    };

    const processPDFExport = (mode) => {
        try {
            let exportCount = 0;

            sessions.forEach(session => {
                if (!selectedSessions.includes(session.id) || session.indent_items.length === 0) return;

                const doc = generatePDFDocument(session);
                const timestamp = dayjs(session.created_at).format('YYYYMMDD_HHmm');
                const safeName = (session.profiles?.name || 'User').replace(/[^a-z0-9]/gi, '_');
                const filename = `Indent_${safeName}_${timestamp}.pdf`;

                if (mode === 'download') {
                    doc.save(filename);
                } else {
                    doc.setProperties({ title: filename });
                    const pdfBlob = doc.output('blob');
                    const pdfUrl = URL.createObjectURL(pdfBlob);
                    window.open(pdfUrl, '_blank');
                }
                exportCount++;
            });

            if (exportCount > 0) {
                message.success(`Successfully processed ${exportCount} PDF(s)!`);
            } else {
                message.warning('No sessions selected to process.');
            }
        } catch (error) {
            console.error('Error exporting to PDF:', error);
            message.error('Failed to export to PDF');
        }
    };

    if (loading) return <div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div>;

    return (
        <div className="cart-page">
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                        <Title level={3} style={{ margin: 0 }}>Indent Cart</Title>
                        <Text type="secondary">{sessions.length} submitted session(s) waiting for approval</Text>
                    </div>
                    <Space wrap>
                        <Button
                            icon={<HistoryOutlined style={{ fontSize: 16 }} />}
                            onClick={() => navigate('/indent-list')}
                        >
                            <span>Indent Records</span>
                        </Button>
                        <Button
                            icon={<EyeOutlined style={{ fontSize: 19 }} />}
                            onClick={() => processPDFExport('preview')}
                            disabled={sessions.length === 0}
                            tooltip={<span>Preview Selected</span>}
                            size="large"
                            style={{ backgroundColor: sessions.length === 0 ? undefined : '#b8008aff', borderColor: sessions.length === 0 ? '#d6d6d6' : '#b8008aff', color: sessions.length === 0 ? undefined : '#fff' }}
                        />
                        <Button
                            icon={<DownOutlined style={{ fontSize: 19 }} />}
                            onClick={() => processPDFExport('download')}
                            disabled={sessions.length === 0}
                            tooltip={<span>Download Selected</span>}
                            size="large"
                            style={{ backgroundColor: sessions.length === 0 ? undefined : '#0050b3', borderColor: sessions.length === 0 ? '#d6d6d6' : '#0050b3', color: sessions.length === 0 ? undefined : '#fff' }}
                        >
                            <span>Download PDFs</span>
                        </Button>
                    </Space>
                </div>

                {sessions.length === 0 && <Empty description="No submitted indents waiting for approval" />}

                {sessions.length > 0 && (
                    <Collapse defaultActiveKey={sessions.map(s => s.id)}>
                        {sessions.map((session) => (
                            <Panel
                                header={
                                    <Space wrap>
                                        <span onClick={(e) => e.stopPropagation()}>
                                            <Checkbox
                                                checked={selectedSessions.includes(session.id)}
                                                onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    setSelectedSessions(prev => checked
                                                        ? [...prev, session.id]
                                                        : prev.filter(id => id !== session.id)
                                                    );
                                                }}
                                            />
                                        </span>
                                        <Text strong>{session.profiles?.name}</Text>
                                        <Tag color="cyan">{dayjs(session.created_at).format('DD/MM/YYYY HH:mm')}</Tag>
                                        <Tag color="geekblue">{session.session_type}</Tag>
                                        {session.rak && <Tag color="purple">Rak: {session.rak}</Tag>}
                                        <Text type="secondary">({session.indent_items.length} items)</Text>
                                    </Space>
                                }
                                key={session.id}
                                extra={
                                    <Popconfirm
                                        title="Clear this session?"
                                        description="Mark this indent as approved and processed?"
                                        onConfirm={(e) => {
                                            e.stopPropagation();
                                            handleClearSession(session.id);
                                        }}
                                        onCancel={(e) => e.stopPropagation()}
                                        okText="Yes"
                                        cancelText="No"
                                    >
                                        <Button
                                            size="small"
                                            type="primary"
                                            icon={<CheckCircleOutlined />}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            Approve & Clear
                                        </Button>
                                    </Popconfirm>
                                }
                            >
                                <List
                                    dataSource={session.indent_items}
                                    renderItem={(item) => (
                                        <List.Item style={{ padding: '12px 0' }}>
                                            <List.Item.Meta
                                                title={
                                                    <Space>
                                                        {item.inventory_items?.puchase_type && (
                                                            <Tag color={getPuchaseTypeColor(item.inventory_items?.puchase_type)}>
                                                                {item.inventory_items?.puchase_type}
                                                            </Tag>
                                                        )}
                                                        {item.inventory_items?.std_kt && (
                                                            <Tag color={getStdKtColor(item.inventory_items?.std_kt)}>
                                                                {item.inventory_items?.std_kt}
                                                            </Tag>
                                                        )}
                                                        <Text strong>{item.inventory_items?.name}</Text>
                                                        {item.inventory_items?.pku && (<Text>| PKU: {item.inventory_items?.pku}</Text>)}
                                                    </Space>
                                                }
                                                description={
                                                    <Space style={{ marginTop: 4 }}>
                                                        <Tag color="default">Requested: <Text strong>{item.requested_qty}</Text></Tag>
                                                        {item.indent_remarks && (
                                                            <Text type="secondary" italic>"{item.indent_remarks}"</Text>
                                                        )}
                                                    </Space>
                                                }
                                            />
                                        </List.Item>
                                    )}
                                />
                            </Panel>
                        ))}
                    </Collapse>
                )}
            </Space>
        </div>
    );
};

export default CartPage;
