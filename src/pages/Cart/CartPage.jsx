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
    InputNumber,
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

    // Edit Modal State
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [newQuantity, setNewQuantity] = useState(0);
    const [updatingQty, setUpdatingQty] = useState(false);

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

            // Fetch pending Ad-hoc indent_requests
            const { data: requestsData, error: requestsError } = await supabase
                .from('indent_requests')
                .select(`
                    id,
                    created_at,
                    requested_qty,
                    snapshot_max_qty,
                    snapshot_balance,
                    status,
                    indent_remarks,
                    inventory_items(*),
                    profiles(name)
                `)
                .eq('status', 'Pending')
                .order('created_at', { ascending: true });

            if (requestsError) throw requestsError;

            // Sort items inside each session alphabetically
            const processedSessions = (sessionsData || [])
                .map(sess => {
                    const sortedItems = [...sess.indent_items]
                        .filter(item => item.requested_qty >= 0)
                        .sort((a, b) =>
                            (a.inventory_items?.name || '').localeCompare(b.inventory_items?.name || '')
                        );
                    return { ...sess, indent_items: sortedItems };
                })
                .filter(sess => sess.indent_items.length > 0);

            // Map indent_requests to a mock session grouped by user
            if (requestsData && requestsData.length > 0) {
                // Group by profile name
                const groupedRequests = requestsData.reduce((acc, req) => {
                    const profileName = req.profiles?.name || 'Unknown Indenter';
                    if (!acc[profileName]) {
                        acc[profileName] = [];
                    }
                    acc[profileName].push(req);
                    return acc;
                }, {});

                // Create a session for each group
                Object.entries(groupedRequests).forEach(([profileName, reqs], index) => {
                    const mappedItems = reqs.map(req => ({
                        id: `req-${req.id}`,
                        original_req_id: req.id,
                        item_id: req.inventory_items?.id,
                        requested_qty: req.requested_qty,
                        snapshot_max_qty: req.snapshot_max_qty,
                        snapshot_balance: req.snapshot_balance,
                        indent_remarks: req.indent_remarks,
                        inventory_items: req.inventory_items,
                        created_at: req.created_at
                    })).sort((a, b) =>
                        (a.inventory_items?.name || '').localeCompare(b.inventory_items?.name || '')
                    );

                    processedSessions.push({
                        id: `adhoc-requests-${profileName}-${index}`, // Make id unique per group
                        created_at: reqs[0].created_at,
                        session_type: 'Urgent Indent',
                        rak: null,
                        profiles: { name: profileName },
                        indent_items: mappedItems,
                        isAdhocRequests: true,
                        profileName: profileName // useful for clearing logic
                    });
                });
            }

            setSessions(processedSessions);
            setSelectedSessions([]);

        } catch (error) {
            console.error('Error fetching cart items:', error);
            message.error('Failed to load cart items');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateQuantity = async () => {
        if (!editingItem) return;

        try {
            setUpdatingQty(true);

            if (editingItem.original_req_id) {
                // Update Ad-hoc Request
                const { error } = await supabase.from('indent_requests').update({ requested_qty: newQuantity }).eq('id', editingItem.original_req_id);
                if (error) throw error;
            } else {
                // Update Session Item
                const { error } = await supabase.from('indent_items').update({ requested_qty: newQuantity }).eq('id', editingItem.id);
                if (error) throw error;
            }

            message.success('Quantity updated successfully');
            setEditModalVisible(false);
            fetchCartSessions(); // Refresh data
        } catch (error) {
            console.error('Error updating quantity:', error);
            message.error('Failed to update quantity');
        } finally {
            setUpdatingQty(false);
        }
    };

    const handleClearSession = async (sessionId) => {
        try {
            // Find if this session is an adhoc session
            const session = sessions.find(s => s.id === sessionId);

            if (session && session.isAdhocRequests) {
                // If this is an adhoc-requests group, we need to extract the original request IDs
                // and mark ONLY those requests as Approved to avoid clearing requests from other users
                const requestIdsToApprove = session.indent_items.map(item => item.original_req_id);

                if (requestIdsToApprove.length > 0) {
                    const { error } = await supabase
                        .from('indent_requests')
                        .update({ status: 'Approved' })
                        .in('id', requestIdsToApprove);

                    if (error) throw error;
                }
            } else {
                // Mark as Approved/Completed
                const { error } = await supabase
                    .from('indent_sessions')
                    .update({ status: 'Approved' })
                    .eq('id', sessionId);

                if (error) throw error;
            }

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
        yPosition += 5;

        const tableData = session.indent_items.map((item, idx) => [
            (idx + 1).toString(),
            (item.inventory_items?.name || '') + (item.inventory_items?.pku ? ` (${item.inventory_items.pku})` : ''),
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
        doc.text(`Tarikh: ${dayjs(session.created_at).format('DD/MM/YYYY')}`, leftX, finalY + 25);

        const middleX = pageWidth / 2 - 20;
        doc.text('Pegawai Pelulus', middleX, finalY);
        doc.text('(Tandatangan)', middleX, finalY + 15);
        doc.text('Nama :', middleX, finalY + 20);
        doc.text('Tarikh :', middleX, finalY + 25);

        const rightX = pageWidth - 60;
        doc.text('Penerima', rightX, finalY);
        doc.text('(Tandatangan)', rightX, finalY + 15);
        doc.text('Nama :  ', rightX, finalY + 20);
        doc.text('Tarikh :', rightX, finalY + 25);

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

                    const newWindow = window.open('', '_blank');
                    if (newWindow) {
                        newWindow.document.title = filename;
                        newWindow.document.body.style.margin = '0';
                        newWindow.document.body.style.overflow = 'hidden';

                        const iframe = newWindow.document.createElement('iframe');
                        iframe.src = pdfUrl;
                        iframe.style.width = '100vw';
                        iframe.style.height = '100vh';
                        iframe.style.border = 'none';
                        iframe.title = filename;

                        newWindow.document.body.appendChild(iframe);
                    } else {
                        window.open(pdfUrl, '_blank');
                    }
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
                    <Collapse>
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
                                        <List.Item
                                            style={{ padding: '12px 0', cursor: 'pointer' }}
                                            onClick={() => {
                                                setEditingItem(item);
                                                setNewQuantity(item.requested_qty);
                                                setEditModalVisible(true);
                                            }}
                                            className="hover:bg-gray-50 transition-colors"
                                        >
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
                                                        {item.inventory_items?.pku && (<Tag color="cyan">{item.inventory_items?.pku}</Tag>)}
                                                    </Space>
                                                }
                                                description={
                                                    <Space style={{ marginTop: 4 }}>
                                                        <Text style={{ color: '#fa8c16' }}>Max: {item.snapshot_max_qty}</Text>
                                                        <Text style={{ color: '#1890ff' }}>Bal: {item.snapshot_balance}</Text>
                                                        <Text strong>Indent: {item.requested_qty}</Text>
                                                        {item.indent_remarks && (
                                                            <Text italic>Remarks: {item.indent_remarks}</Text>
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

            <Modal
                title="Edit Quantity"
                open={editModalVisible}
                onCancel={() => setEditModalVisible(false)}
                confirmLoading={updatingQty}
                width={'450px'}
                onOk={handleUpdateQuantity}
            >
                {editingItem && editingItem.inventory_items && (
                    <div style={{ padding: '10px 0', textAlign: 'center' }}>
                        <Title level={4} style={{ marginBottom: 4 }}>
                            {editingItem.inventory_items.name}
                        </Title>

                        {/* Item Code and PKU */}
                        <Space size="large" style={{ marginBottom: 12 }}>
                            {editingItem.inventory_items.item_code && (
                                <Text type="secondary" style={{ fontSize: '13px' }}>
                                    <Text>{editingItem.inventory_items.item_code}</Text>
                                </Text>
                            )}
                            {editingItem.inventory_items.pku && (
                                <Text type="secondary" style={{ fontSize: '13px' }}>
                                    PKU: <Text strong>{editingItem.inventory_items.pku}</Text>
                                </Text>
                            )}
                        </Space> <br />

                        {/* Tags */}
                        <Space wrap style={{ marginBottom: 12, justifyContent: 'center' }}>
                            {editingItem.inventory_items.puchase_type && (
                                <Tag color={getPuchaseTypeColor(editingItem.inventory_items.puchase_type)}>
                                    {editingItem.inventory_items.puchase_type}
                                </Tag>
                            )}
                            {editingItem.inventory_items.std_kt && (
                                <Tag color={getStdKtColor(editingItem.inventory_items.std_kt)}>
                                    {editingItem.inventory_items.std_kt}
                                </Tag>
                            )}
                            {editingItem.inventory_items.row && <Tag>Row: {editingItem.inventory_items.row}</Tag>}
                        </Space>

                        {/* Inventory Info */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-around',
                            background: '#fafafa',
                            padding: '12px 0',
                            borderRadius: '6px',
                            border: '1px solid #f0f0f0',
                            marginBottom: 16
                        }}>
                            <div style={{ textAlign: 'center' }}>
                                <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>Max Qty</Text>
                                <Text strong style={{ fontSize: '18px', color: '#fa8c16' }}>
                                    {editingItem.inventory_items.max_qty !== null ? editingItem.inventory_items.max_qty : '-'}
                                </Text>
                            </div>
                            <div style={{ width: '1px', background: '#d9d9d9', margin: '0 8px' }}></div>
                            <div style={{ textAlign: 'center' }}>
                                <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>Balance</Text>
                                <Text strong style={{ fontSize: '18px', color: '#1890ff' }}>
                                    {editingItem.inventory_items.balance !== null ? editingItem.inventory_items.balance : '-'}
                                </Text>
                            </div>
                        </div>

                        <div style={{ padding: '16px', background: '#f0f2f5', borderRadius: '8px' }}>
                            <Space align="center" size="middle" direction="vertical" style={{ width: '100%' }}>
                                <Text strong style={{ fontSize: '15px' }}>Request Quantity</Text>
                                <InputNumber
                                    min={0}
                                    value={newQuantity}
                                    onChange={setNewQuantity}
                                    size="large"
                                    autoFocus
                                    inputMode="numeric"
                                    style={{ width: '120px' }}
                                />
                            </Space>

                        </div>
                        {/* Indent Remarks (if available) */}
                        {editingItem.indent_remarks && (
                            <div style={{
                                marginTop: 16,
                                marginBottom: 16,
                                padding: '8px 12px',
                                background: '#e6f7ff',
                                border: '1px solid #91d5ff',
                                borderRadius: '4px',
                                textAlign: 'left'
                            }}>
                                <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                                    Remarks:
                                </Text>
                                <Text>{editingItem.indent_remarks}</Text>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default CartPage;
