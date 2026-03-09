import React, { useState, useEffect, useRef } from 'react';
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
    Input,
    InputNumber,
    Popconfirm,
    Select,
    Row,
    Col,
    Checkbox,
    DatePicker,
} from 'antd';
import {
    FilePdfOutlined,
    EnvironmentOutlined,
    FileExcelOutlined,
    HistoryOutlined,
    EyeOutlined,
    DownOutlined,
    DeleteOutlined,
} from '@ant-design/icons';
import { supabase } from '../../lib/supabase';
import { getSourceColor, getStdKtColor, getPuchaseTypeColor } from '../../lib/colorMappings';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import dayjs from 'dayjs';
import CustomDateInput from '../../components/CustomDateInput';

const { Title, Text } = Typography;
const { Panel } = Collapse;

const CartPage = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [cartItems, setCartItems] = useState([]);
    const [groupedItems, setGroupedItems] = useState({});
    const [editingItem, setEditingItem] = useState(null);
    const [editQuantity, setEditQuantity] = useState('');
    const [editMaxQty, setEditMaxQty] = useState('');
    const [editIndentSource, setEditIndentSource] = useState('');
    const [editRemarks, setEditRemarks] = useState('');
    const [editBalance, setEditBalance] = useState(null);
    const [editIsShortExp, setEditIsShortExp] = useState(false);
    const [editShortExp, setEditShortExp] = useState(null);
    const [hasChanges, setHasChanges] = useState(false);
    const [isIndentSourceDropdownOpen, setIsIndentSourceDropdownOpen] = useState(false);
    const [selectedSources, setSelectedSources] = useState([]);
    const debounceRef = useRef(null);

    // Helper function to calculate indent quantity
    const calculateIndentQty = (maxQty, currentBalance) => {
        const max = parseInt(maxQty) || 0;
        const bal = parseInt(currentBalance) || 0;
        const result = max - bal;
        return result > 0 ? result.toString() : '0';
    };

    const handleBalanceChange = (value) => {
        setEditBalance(value);

        // Recalculate indent quantity when balance changes
        const calculatedQty = calculateIndentQty(editMaxQty, value);
        setEditQuantity(calculatedQty);

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setHasChanges(true);
        }, 500);
    };

    const handleShortExpChange = (e) => {
        setEditIsShortExp(e.target.checked);
        setHasChanges(true);
    };

    const handleShortExpDateChange = (date) => {
        setEditShortExp(date);
        setHasChanges(true);
    };

    useEffect(() => {
        fetchCartItems();
    }, []);

    useEffect(() => {
        groupItemsBySource();
    }, [cartItems]);

    const fetchCartItems = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('indent_requests')
                .select(`
          *,
          inventory_items (*)
        `)
                .eq('status', 'Pending')
                .order('created_at', { ascending: false });

            if (error) throw error;

            setCartItems(data || []);
        } catch (error) {
            console.error('Error fetching cart items:', error);
            message.error('Failed to load cart items');
        } finally {
            setLoading(false);
        }
    };

    const groupItemsBySource = () => {
        const grouped = {
            IPD: [],
            OPD: [],
            MFG: [],
        };

        cartItems.forEach(item => {
            const source = item.inventory_items?.indent_source || 'OPD';
            if (!grouped[source]) {
                grouped[source] = [];
            }
            grouped[source].push(item);
        });

        // Sort items within each group by name A-Z
        Object.keys(grouped).forEach(source => {
            grouped[source].sort((a, b) => {
                const nameA = a.inventory_items?.name || '';
                const nameB = b.inventory_items?.name || '';
                return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
            });
        });

        setGroupedItems(grouped);

        // Initialize selected sources (all selected by default)
        //const sourcesWithItems = Object.keys(grouped).filter(source => grouped[source].length > 0);
        //setSelectedSources(sourcesWithItems);
    };

    const handleDelete = async (itemId) => {
        try {
            const { error } = await supabase
                .from('indent_requests')
                .delete()
                .eq('id', itemId);

            if (error) throw error;

            message.success('Item removed from cart');
            fetchCartItems();
        } catch (error) {
            console.error('Error deleting item:', error);
            message.error('Failed to remove item');
        }
    };

    const handleEdit = (item) => {
        setEditingItem(item);
        setEditQuantity(item.requested_qty);
        setEditMaxQty(item.inventory_items?.max_qty || '');
        setEditBalance(item.inventory_items?.balance);
        setEditIndentSource(item.inventory_items?.indent_source || '');
        setEditRemarks(item.inventory_items?.remarks || '');
        setEditIsShortExp(item.inventory_items?.is_short_exp || false);
        setEditShortExp(item.inventory_items?.short_exp ? dayjs(item.inventory_items.short_exp) : null);
        setHasChanges(false);
        setIsIndentSourceDropdownOpen(false);
    };


    const handleMaxQtyChange = (value) => {
        setEditMaxQty(value);

        // Recalculate indent quantity when max qty changes
        const calculatedQty = calculateIndentQty(value, editBalance);
        setEditQuantity(calculatedQty);

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setHasChanges(true);
        }, 500);
    };

    const handleIndentSourceChange = (value) => {
        setEditIndentSource(value);
        setIsIndentSourceDropdownOpen(false);
        if (document.activeElement) {
            document.activeElement.blur();
        }
        setHasChanges(true);
    };

    const handleRemarksChange = (e) => {
        setEditRemarks(e.target.value);
        setHasChanges(true);
    };

    const handleQuantityChange = (value) => {
        setEditQuantity(value);
        setHasChanges(true);
    };

    const handleCloseEdit = () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        setEditingItem(null);
        setHasChanges(false);
    };

    const saveQuickUpdates = async () => {
        // Validate quantity before saving
        if (!editQuantity || editQuantity === 0 || editQuantity === '0') {
            message.error('Indent quantity cannot be 0 or empty. Please enter a valid quantity.');
            return;
        }

        try {
            // Update inventory item details
            const { error: inventoryError } = await supabase
                .from('inventory_items')
                .update({
                    max_qty: editMaxQty === '' ? null : editMaxQty,
                    balance: editBalance === '' ? null : editBalance,
                    indent_source: editIndentSource,
                    remarks: editRemarks,
                    is_short_exp: editIsShortExp,
                    short_exp: editShortExp ? editShortExp.format('YYYY-MM-DD') : null,
                })
                .eq('id', editingItem.item_id);

            if (inventoryError) throw inventoryError;

            // Update indent request quantity
            const { error: requestError } = await supabase
                .from('indent_requests')
                .update({ requested_qty: editQuantity })
                .eq('id', editingItem.id);

            if (requestError) throw requestError;

            message.success('Item details updated');
            setHasChanges(false);
            setEditingItem(null);
            fetchCartItems();
        } catch (error) {
            console.error('Error updating item details:', error);
            message.error('Failed to update item details');
        }
    };

    const handleSaveEdit = async () => {
        await saveQuickUpdates();
    };

    const handleApproveIndent = async () => {
        try {
            const { error } = await supabase
                .from('indent_requests')
                .update({ status: 'Approved' })
                .eq('status', 'Pending');

            if (error) throw error;

            message.success('Indent cleared successfully!');
            fetchCartItems();
        } catch (error) {
            console.error('Error clearing indent:', error);
            message.error('Failed to clear indent');
        }
    };

    const generatePDFDocument = (source, items) => {
        // 1. Initialize Landscape PDF
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        let yPosition = 15;

        // Header - Form Reference
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
        const title = `BORANG PERMOHONAN STOK UBAT (${source})`;
        doc.text(title, pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 5;

        // Table Data mapping
        const tableData = items.map((item, idx) => [
            (idx + 1).toString(),
            (item.inventory_items?.name || '') + (item.inventory_items?.pku ? ` | ${item.inventory_items.pku}` : ''),
            item.requested_qty || 0,
            '',
            '',
            '',
        ]);

        // 4. AutoTable Configuration
        autoTable(doc, {
            startY: yPosition,
            head: [[
                { content: 'Bil', styles: { halign: 'center' } },
                { content: 'Perihal stok', styles: { halign: 'center' } },
                { content: 'Kuantiti', styles: { halign: 'center' } },
                { content: 'Catatan', styles: { halign: 'center' } },
                { content: 'Kuantiti Diluluskan', styles: { halign: 'center' } },
                { content: 'Catatan', styles: { halign: 'center' } },
            ]],
            body: tableData,
            theme: 'grid',
            styles: {
                fontSize: 10, // Slightly smaller font to accommodate more columns
                cellPadding: 3,
            },
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
                minCellHeight: 9, // Added height for manual writing room
            },
            // 2. Adjusted widths: First 4 cols ~65%, Last 2 cols ~35%
            columnStyles: {
                0: { cellWidth: 11, halign: 'center' }, // Bil
                1: { cellWidth: 78 },                  // Perihal
                2: { cellWidth: 29, halign: 'center' }, // Kuantiti
                3: { cellWidth: 25 },                  // Catatan (Req)
                4: { cellWidth: 29, halign: 'center' }, // Kuantiti Diluluskan
                5: { cellWidth: 25 },                  // Catatan (Appr)
            },
            margin: { bottom: 50, left: 7, right: 7 },

            // 3. Hook to draw the Thick Border
            didDrawCell: function (data) {
                // Check if this is the 'Kuantiti Diluluskan' column (Index 4)
                if (data.column.index === 4) {
                    doc.setLineWidth(0.8); // Set thick line
                    doc.line(data.cell.x, data.cell.y, data.cell.x, data.cell.y + data.cell.height);
                    doc.setLineWidth(0.2); // Reset to default
                }
            },

        });

        // Signatures (Moved outside autoTable to show only on last page)
        const finalY = pageHeight - 50;
        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');

        const leftX = 15;
        doc.text('Pemohon', leftX, finalY);
        doc.text('(Tandatangan)', leftX, finalY + 15);
        doc.text('Nama : ', leftX, finalY + 20);
        doc.text('Jawatan : ', leftX, finalY + 25);
        doc.text('Tarikh :', leftX, finalY + 30);

        const middleX = pageWidth / 2 - 20;
        doc.text('Pegawai Pelulus', middleX, finalY);
        doc.text('(Tandatangan)', middleX, finalY + 15);
        doc.text('Nama :', middleX, finalY + 20);
        doc.text('Jawatan :', middleX, finalY + 25);
        doc.text('Tarikh :', middleX, finalY + 30);

        const rightX = pageWidth - 60;
        doc.text('Penerima', rightX, finalY);
        doc.text('(Tandatangan)', rightX, finalY + 15);
        doc.text('Nama :  ', rightX, finalY + 20);
        doc.text('Jawatan :  ', rightX, finalY + 25);
        doc.text('Tarikh :', rightX, finalY + 30);

        return doc;
    };

    // 2. Main handler that decides whether to Download or Preview
    const processPDFExport = (mode) => {
        try {
            let exportCount = 0;

            Object.entries(groupedItems).forEach(([source, items]) => {
                if (items.length === 0 || !selectedSources.includes(source)) return;

                // Generate the doc using our helper
                const doc = generatePDFDocument(source, items);
                const timestamp = new Date().toISOString().split('T')[0];
                const filename = `OPD_Indent_${source}_${timestamp}.pdf`;

                if (mode === 'download') {
                    // A. DOWNLOAD MODE
                    doc.save(filename);
                } else {
                    // B. PREVIEW MODE
                    // Try to set title metadata (browsers might use this as tab title)
                    doc.setProperties({ title: filename });

                    const pdfBlob = doc.output('blob');
                    const pdfUrl = URL.createObjectURL(pdfBlob);
                    window.open(pdfUrl, '_blank');
                }
                exportCount++;
            });

            if (exportCount > 0) {
                message.success(`Successfully downloaded ${exportCount} PDF file(s)!`);
            } else {
                message.warning('No items to preview/download.');
            }
        } catch (error) {
            console.error('Error exporting to PDF:', error);
            message.error('Failed to export to PDF');
        }
    };

    const handleExportToExcel = () => {
        try {
            // Create workbook
            const wb = XLSX.utils.book_new();

            // Prepare data for each source
            Object.entries(groupedItems).forEach(([source, items]) => {
                if (items.length === 0) return;

                // Create worksheet data
                const wsData = [
                    // Header row
                    ['Drug Name', 'Quantity'],
                    // Data rows
                    ...items.map(item => [
                        item.inventory_items?.name || '',
                        item.requested_qty || 0,
                    ])
                ];

                // Create worksheet
                const ws = XLSX.utils.aoa_to_sheet(wsData);

                // Set column widths
                ws['!cols'] = [
                    { wch: 30 }, // Drug Name
                    { wch: 15 }, // Quantity
                ];

                // Add worksheet to workbook
                XLSX.utils.book_append_sheet(wb, ws, source);
            });

            // Generate filename with timestamp
            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `Indent_Cart_${timestamp}.xlsx`;

            // Save file
            XLSX.writeFile(wb, filename);
            message.success('Excel file exported successfully!');
        } catch (error) {
            console.error('Error exporting to Excel:', error);
            message.error('Failed to export to Excel');
        }
    };

    const renderItemActions = (item) => [
        <Popconfirm
            key="delete"
            title="Remove this item from cart?"
            onConfirm={(e) => {
                e?.stopPropagation();
                handleDelete(item.id);
            }}
            okText="Yes"
            cancelText="No"
            onCancel={(e) => e?.stopPropagation()}
        >
            <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={(e) => e.stopPropagation()}
            />
        </Popconfirm>,
    ];

    const renderMobileActions = (item) => (
        <Popconfirm
            title="Remove?"
            onConfirm={(e) => {
                e?.stopPropagation();
                handleDelete(item.id);
            }}
            okText="Yes"
            cancelText="No"
            onCancel={(e) => e?.stopPropagation()}
        >
            <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={(e) => e.stopPropagation()}
            />
        </Popconfirm>
    );

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '50px' }}>
                <Spin size="large" />
            </div>
        );
    }

    const totalItems = cartItems.length;

    return (
        <div className="cart-page">
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {/* Header */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: '16px'
                }}>
                    <div>
                        <Title level={3} style={{ margin: 0 }}>Indent Cart</Title>
                        <Text type="secondary">
                            {totalItems} {totalItems === 1 ? 'item' : 'items'} in cart
                        </Text>
                    </div>
                    <Space wrap>
                        <Button
                            icon={<HistoryOutlined style={{ fontSize: 16 }} />}
                            onClick={() => navigate('/indent-list')}
                        >
                            <span className="button-text">Previous Indent</span>
                        </Button>
                        {/* <Button
                            icon={<FileExcelOutlined />}
                            onClick={handleExportToExcel}
                            disabled={totalItems === 0}
                            style={{
                                backgroundColor: totalItems === 0 ? undefined : '#217346',
                                borderColor: '#217346',
                                color: totalItems === 0 ? undefined : '#fff'
                            }}
                        >
                            <span className="button-text">Export to Excel</span>
                        </Button> */}
                        <Button
                            icon={<EyeOutlined style={{ fontSize: 19 }} />}
                            onClick={() => processPDFExport('preview')}
                            disabled={totalItems === 0}
                            tooltip={<span>Preview</span>}
                            size="large"
                            style={{
                                backgroundColor: totalItems === 0 ? undefined : '#b8008aff ',
                                borderColor: totalItems === 0 ? '#d6d6d6' : '#b8008aff ',
                                color: totalItems === 0 ? undefined : '#fff'
                            }}
                        >
                        </Button>
                        <Button
                            icon={<DownOutlined style={{ fontSize: 19 }} />}
                            onClick={() => processPDFExport('download')}
                            disabled={totalItems === 0}
                            tooltip={<span>Download</span>}
                            size="large"
                            style={{
                                backgroundColor: totalItems === 0 ? undefined : '#0050b3 ',
                                borderColor: totalItems === 0 ? '#d6d6d6' : '#0050b3 ',
                                color: totalItems === 0 ? undefined : '#fff'
                            }}
                        >
                            <span className="button-text">Download</span>
                        </Button>

                        <Button
                            type="primary"
                            icon={<DeleteOutlined style={{ fontSize: 19 }} />}
                            onClick={handleApproveIndent}
                            disabled={totalItems === 0}
                            tooltip={<span>Clear All</span>}
                            size="large"
                            style={{
                                backgroundColor: totalItems === 0 ? undefined : '#cf1322 ',
                                borderColor: totalItems === 0 ? '#d6d6d6' : '#cf1322 ',
                                color: totalItems === 0 ? undefined : '#fff'
                            }}
                        >
                            <span className="button-text">Clear All</span>
                        </Button>
                    </Space>
                </div>

                {/* Empty State */}
                {totalItems === 0 && (
                    <Empty description="No pending items in cart" />
                )}

                {/* Grouped Items */}
                {totalItems > 0 && (
                    <Collapse>
                        {Object.entries(groupedItems).map(([source, items]) => {
                            if (items.length === 0) return null;

                            return (
                                <Panel
                                    header={
                                        <Space>
                                            <span onClick={(e) => e.stopPropagation()}>
                                                <Checkbox
                                                    checked={selectedSources.includes(source)}
                                                    onChange={(e) => {
                                                        const checked = e.target.checked;
                                                        setSelectedSources(prev => checked
                                                            ? [...prev, source]
                                                            : prev.filter(s => s !== source)
                                                        );
                                                    }}
                                                />
                                            </span>
                                            <Tag color={getSourceColor(source)}>{source}</Tag>
                                            <Text>{items.length} {items.length === 1 ? 'item' : 'items'}</Text>
                                        </Space>
                                    }
                                    key={source}
                                >
                                    <List
                                        dataSource={items}
                                        renderItem={(item) => (
                                            <List.Item
                                                actions={window.innerWidth > 768 ? renderItemActions(item) : undefined}
                                                style={{ flexWrap: 'wrap', cursor: 'pointer' }}
                                                onClick={() => handleEdit(item)}
                                            >
                                                <List.Item.Meta
                                                    title={
                                                        <Space>
                                                            {item.inventory_items?.puchase_type && (
                                                                <Tag color={getPuchaseTypeColor(item.inventory_items?.puchase_type)} style={{ margin: 0, fontSize: '11px' }}>
                                                                    {item.inventory_items?.puchase_type}
                                                                </Tag>
                                                            )}
                                                            {item.inventory_items?.std_kt && (
                                                                <Tag color={getStdKtColor(item.inventory_items?.std_kt)} style={{ margin: 0, fontSize: '11px' }}>
                                                                    {item.inventory_items?.std_kt}
                                                                </Tag>
                                                            )}
                                                            <Text strong>{item.inventory_items?.name}</Text>
                                                            {item.inventory_items?.pku && (<Text >| {item.inventory_items?.pku}</Text>)}
                                                        </Space>
                                                    }
                                                    description={
                                                        <Space direction="vertical" size="small">
                                                            <Text>Qty: <Text strong>{item.requested_qty}</Text></Text>
                                                        </Space>
                                                    }
                                                />
                                                {/* Mobile actions */}
                                                <div className="mobile-actions">
                                                    {renderMobileActions(item)}
                                                </div>
                                            </List.Item>
                                        )}
                                    />
                                </Panel>
                            );
                        })}
                    </Collapse>
                )}
            </Space>

            {/* Edit Cart Item Modal */}
            <Modal
                title="Edit Indent"
                open={editingItem !== null}
                onCancel={handleCloseEdit}
                centered
                width={450}
                footer={null}
            >
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    {/* Drug Info */}
                    <div style={{ textAlign: 'center' }}>
                        <Title level={4} style={{ marginBottom: 4 }}>
                            {editingItem?.inventory_items?.name}
                        </Title>

                        {/* Item Code and PKU */}
                        <Space size="large" style={{ marginBottom: 12 }}>
                            {editingItem?.inventory_items?.pku && (
                                <Text type="secondary" style={{ fontSize: '13px' }}>
                                    PKU: <Text strong>{editingItem?.inventory_items?.pku}</Text>
                                </Text>
                            )}
                        </Space> <br />

                        {/* Tags */}
                        <Space wrap style={{ marginBottom: 8, justifyContent: 'center' }}>
                            {editingItem?.inventory_items?.puchase_type && (
                                <Tag color={getPuchaseTypeColor(editingItem.inventory_items.puchase_type)}>
                                    {editingItem.inventory_items.puchase_type}
                                </Tag>
                            )}
                            {editingItem?.inventory_items?.std_kt && (
                                <Tag color={getStdKtColor(editingItem.inventory_items.std_kt)}>
                                    {editingItem.inventory_items.std_kt}
                                </Tag>
                            )}
                            {editingItem?.inventory_items?.row && <Tag>Row: {editingItem.inventory_items.row}</Tag>}
                        </Space>

                        {/* Remarks */}
                        {editRemarks && (
                            <div style={{ marginTop: 8, padding: '8px 16px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                                <Text style={{ fontSize: '13px', fontStyle: 'italic' }}>
                                    {editRemarks}
                                </Text>
                            </div>
                        )}
                    </div>

                    {/* Editable Stock Info */}
                    <div style={{
                        backgroundColor: '#fafafa',
                        padding: '16px',
                        borderRadius: '8px',
                        border: '1px solid #f0f0f0'
                    }}>
                        {hasChanges && (
                            <div style={{ marginBottom: 12, textAlign: 'center' }}>
                                <Text type="warning" style={{ fontSize: 12 }}>
                                    ⚠ Unsaved changes
                                </Text>
                            </div>
                        )}

                        {/* Stock Information */}
                        <Row gutter={[16, 16]}>
                            <Col xs={12}>
                                <div>
                                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                                        Max Qty
                                    </Text>
                                    <InputNumber
                                        value={editMaxQty}
                                        onChange={handleMaxQtyChange}
                                        placeholder="Max Qty"
                                        style={{ width: '100%' }}
                                        min={0}
                                        size="large"
                                    />
                                </div>
                            </Col>
                            <Col xs={12}>
                                <div>
                                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                                        Balance
                                    </Text>
                                    <InputNumber
                                        value={editBalance}
                                        onChange={handleBalanceChange}
                                        placeholder="Balance"
                                        style={{ width: '100%' }}
                                        min={0}
                                        size="large"
                                    />
                                </div>
                            </Col>
                        </Row>

                        {/* Indent Source */}
                        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                            <Col xs={24}>
                                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                                    Indent From
                                </Text>
                                <Select
                                    value={editIndentSource}
                                    onChange={handleIndentSourceChange}
                                    style={{ width: '100%' }}
                                    placeholder="Select source"
                                    size="large"
                                    virtual={false}
                                    showSearch={false}
                                    open={isIndentSourceDropdownOpen}
                                    onDropdownVisibleChange={(visible) => setIsIndentSourceDropdownOpen(visible)}
                                >
                                    <Select.Option value="OPD Kaunter">OPD Kaunter</Select.Option>
                                    <Select.Option value="OPD Substor">OPD Substor</Select.Option>
                                    <Select.Option value="IPD Kaunter">IPD Kaunter</Select.Option>
                                    <Select.Option value="IPD Substor">IPD Substor</Select.Option>
                                    <Select.Option value="MNF Substor">MNF Substor</Select.Option>
                                    <Select.Option value="MNF Eksternal">MNF Eksternal</Select.Option>
                                    <Select.Option value="MNF Internal">MNF Internal</Select.Option>
                                    <Select.Option value="Prepacking">Prepacking</Select.Option>
                                    <Select.Option value="HPSF Muar">HPSF Muar</Select.Option>
                                </Select>
                            </Col>
                        </Row>
                    </div>

                    {/* Indent Quantity Input */}
                    <div>
                        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                            Indent Quantity
                        </Text>
                        <InputNumber
                            autoFocus
                            value={editQuantity}
                            onChange={handleQuantityChange}
                            style={{ width: '100%' }}
                            placeholder="e.g., 10 bot, 5x30's, 2 carton"
                            min={0}
                            size="large"
                        />
                    </div>

                    {/* Action Buttons */}
                    <div style={{ marginBottom: 0 }}>
                        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                            {hasChanges && (
                                <Button
                                    onClick={saveQuickUpdates}
                                    type="default"
                                    style={{ borderColor: '#52c41a', color: '#52c41a' }}>
                                    Save Changes
                                </Button>
                            )}

                            <Button onClick={handleCloseEdit}>Cancel</Button>
                        </Space>
                    </div>
                </Space>
            </Modal>

            {/* Responsive Styles */}
            <style>{`
                /* Excel button styling */
                .ant-btn:has(.anticon-file-excel) {
                    transition: all 0.3s ease;
                }
                
                .ant-btn:has(.anticon-file-excel):hover:not(:disabled) {
                    background-color: #1a5c37 !important;
                    border-color: #1a5c37 !important;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 8px rgba(33, 115, 70, 0.3);
                }
                
                /* PDF button styling */
                .ant-btn:has(.anticon-file-pdf) {
                    transition: all 0.3s ease;
                }
                
                .ant-btn:has(.anticon-file-pdf):hover:not(:disabled) {
                    background-color: #c82333 !important;
                    border-color: #c82333 !important;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 8px rgba(220, 53, 69, 0.3);
                }
                
                /* Desktop: show desktop actions, hide mobile actions */
                @media (min-width: 769px) {
                    .mobile-actions {
                        display: none;
                    }
                }
                
                /* Mobile: hide desktop actions, show mobile actions */
                @media (max-width: 768px) {
                    .button-text {
                        display: none;
                    }
                    
                    .action-text {
                        display: none;
                    }
                    
                    .ant-list-item-action {
                        display: none !important;
                    }
                    
                    .mobile-actions {
                        display: block;
                        width: 100%;
                        margin-top: 12px;
                        padding-top: 12px;
                        border-top: 1px solid #f0f0f0;
                    }
                    
                    .ant-list-item {
                        padding: 12px !important;
                        flex-direction: column;
                        align-items: flex-start !important;
                    }
                    
                    .ant-list-item-meta {
                        width: 100%;
                    }
                    
                    .ant-collapse-header {
                        padding: 12px !important;
                    }
                    
                    .ant-space-horizontal {
                        gap: 8px !important;
                    }
                }
                
                @media (max-width: 480px) {
                    .cart-page .ant-typography h3 {
                        font-size: 18px !important;
                    }
                    
                    .ant-btn {
                        padding: 4px 8px !important;
                    }
                    
                    .ant-tag {
                        font-size: 11px !important;
                        padding: 0 4px !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default CartPage;
