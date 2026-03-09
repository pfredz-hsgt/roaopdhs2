import React, { useState, useEffect } from 'react';
import {
    Typography,
    Space,
    Collapse,
    List,
    Tag,
    Empty,
    Spin,
    message,
    DatePicker,
    Badge,
    Button,
    Checkbox,
} from 'antd';
import {
    EnvironmentOutlined,
    DownOutlined,
    EyeOutlined,
} from '@ant-design/icons';
import { supabase } from '../../lib/supabase';
import { getSourceColor, getStdKtColor } from '../../lib/colorMappings';
import dayjs from 'dayjs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const { Title, Text } = Typography;
const { Panel } = Collapse;

const IndentListPage = () => {
    const [loading, setLoading] = useState(true);
    const [indentItems, setIndentItems] = useState([]);
    const [groupedItems, setGroupedItems] = useState({});
    const [selectedDate, setSelectedDate] = useState(dayjs());
    const [datesWithIndents, setDatesWithIndents] = useState([]);
    const [selectedSources, setSelectedSources] = useState([]);

    useEffect(() => {
        fetchDatesWithIndents();
    }, []);

    useEffect(() => {
        if (selectedDate) {
            fetchIndentItems();
        }
    }, [selectedDate]);

    useEffect(() => {
        groupItemsBySource();
    }, [indentItems]);

    const fetchDatesWithIndents = async () => {
        try {
            const { data, error } = await supabase
                .from('indent_requests')
                .select('created_at')
                .eq('status', 'Approved')
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Extract unique dates
            const uniqueDates = [...new Set(
                data.map(item => dayjs(item.created_at).format('YYYY-MM-DD'))
            )];

            setDatesWithIndents(uniqueDates);
        } catch (error) {
            console.error('Error fetching dates:', error);
            message.error('Failed to load indent dates');
        }
    };

    const fetchIndentItems = async () => {
        try {
            setLoading(true);
            const startOfDay = selectedDate.startOf('day').toISOString();
            const endOfDay = selectedDate.endOf('day').toISOString();

            const { data, error } = await supabase
                .from('indent_requests')
                .select(`
          *,
          inventory_items (*)
        `)
                .eq('status', 'Approved')
                .gte('created_at', startOfDay)
                .lte('created_at', endOfDay)
                .order('created_at', { ascending: false });

            if (error) throw error;

            setIndentItems(data || []);
        } catch (error) {
            console.error('Error fetching indent items:', error);
            message.error('Failed to load indent items');
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

        indentItems.forEach(item => {
            const source = item.inventory_items?.indent_source || 'OPD';
            if (!grouped[source]) {
                grouped[source] = [];
            }
            grouped[source].push(item);
        });

        setGroupedItems(grouped);
    };


    const generatePDFDocument = (source, items) => {
        // 1. Initialize Landscape PDF
        const doc = new jsPDF({ orientation: 'landscape' });
        const pageWidth = doc.internal.pageSize.getWidth(); // ~297mm
        const pageHeight = doc.internal.pageSize.getHeight(); // ~210mm
        const halfWidth = pageWidth / 2;

        // 2. Draw Dotted Line in the middle for cutting
        doc.setLineWidth(0.2);
        doc.setLineDash([1, 1], 0); // 1mm dash, 1mm space
        doc.setDrawColor(150);
        doc.line(halfWidth, 5, halfWidth, pageHeight - 5); // Coordinate x,y,x,y start to end point
        doc.setLineDash([]); // Reset to solid lines for the rest of the doc
        doc.setDrawColor(0); // Reset to solid black

        // Generate the page content twice on the SAME page (Left side, then Right side)
        const copies = ['SALINAN PEMESAN', 'SALINAN PENGELUAR'];

        copies.forEach((copyLabel, copyIndex) => {
            // 3. Calculate X Offset based on which copy we are drawing
            // Index 0 (Left) = 0 offset
            // Index 1 (Right) = 148.5 offset
            const xOffset = copyIndex * halfWidth;

            // Define local left and right bounds for this specific panel
            const panelLeft = xOffset;
            const panelRight = xOffset + halfWidth;
            const panelCenter = xOffset + (halfWidth / 2);

            let yPosition = 15;

            // Set text color to true black for all text
            doc.setTextColor(0, 0, 0);

            // Copy Label
            doc.setFontSize(9);
            doc.setFont(undefined, 'bold');
            // Position relative to the panel's right edge
            doc.text(copyLabel, panelRight - 7, yPosition, { align: 'right' });
            yPosition += 5;

            // Header - Form Reference
            doc.setFontSize(8);
            doc.setFont(undefined, 'italic');
            doc.text('Pekeliling Perbendaharaan Malaysia', panelLeft + 7, yPosition);
            doc.setFont(undefined, 'normal');
            doc.text('AM 6.5 LAMPIRAN B', panelCenter, yPosition, { align: 'center' });
            doc.text('KEW.PS-8', panelRight - 7, yPosition, { align: 'right' });
            yPosition += 10;

            // Title
            doc.setFontSize(10); // Slightly smaller title to fit
            doc.setFont(undefined, 'bold');
            const title = `BORANG PERMOHONAN STOK UBAT (${source})`;
            doc.text(title, panelCenter, yPosition, { align: 'center' });
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
                    { content: 'Qty', styles: { halign: 'center' } }, // Shortened header
                    { content: 'Catatan', styles: { halign: 'center' } },
                    { content: 'Lulus', styles: { halign: 'center' } }, // Shortened header
                    { content: 'Catatan', styles: { halign: 'center' } },
                ]],
                body: tableData,
                theme: 'grid',
                styles: {
                    fontSize: 8, // Reduced font size for half-page width
                    cellPadding: 2,
                    textColor: [0, 0, 0],
                    lineColor: [0, 0, 0],
                    lineWidth: 0.1,
                },
                headStyles: {
                    fillColor: [255, 255, 255],
                    textColor: [0, 0, 0],
                    fontStyle: 'bold',
                    lineWidth: 0.1,
                    lineColor: [0, 0, 0],
                },
                bodyStyles: {
                    minCellHeight: 8,
                },
                // 5. Dynamic Margins to constrain table to Left or Right side
                margin: {
                    top: 15,
                    // If Copy 0 (Left): Left Margin 7, Right Margin (HalfWidth + 7)
                    // If Copy 1 (Right): Left Margin (HalfWidth + 7), Right Margin 7
                    left: panelLeft + 5,
                    right: (pageWidth - panelRight) + 5
                },
                // Adjusted columns for narrower width
                columnStyles: {
                    0: { cellWidth: 8, halign: 'center' },  // Bil
                    1: { cellWidth: 'auto' },               // Perihal (Auto expand)
                    2: { cellWidth: 12, halign: 'center' }, // Kuantiti
                    3: { cellWidth: 15 },                   // Catatan
                    4: { cellWidth: 12, halign: 'center' }, // Lulus
                    5: { cellWidth: 15 },                   // Catatan
                },
                didDrawCell: function (data) {
                    if (data.column.index === 4) {
                        doc.setLineWidth(0.6);
                        doc.line(data.cell.x, data.cell.y, data.cell.x, data.cell.y + data.cell.height);
                        doc.setLineWidth(0.1);
                    }
                },
            });

            // Signatures
            const finalY = pageHeight - 25; // Moved up slightly
            doc.setFontSize(7); // Smaller font for signature area
            doc.setFont(undefined, 'normal');

            // 6. Signature Positioning adjusted for Left/Right panels

            // Left Signature (Pemohon)
            const leftX = panelLeft + 10;
            doc.text('Pemohon', leftX, finalY);
            doc.text('(Tandatangan)', leftX, finalY + 10);
            doc.text('Nama : ', leftX, finalY + 13);
            doc.text('Jawatan : ', leftX, finalY + 16);
            doc.text(`Tarikh : ${new Date().toLocaleDateString('en-GB')}`, leftX, finalY + 19);

            // Middle Signature (Pegawai Pelulus)
            // Positioned roughly in the center of the PANEL
            const middleX = panelCenter - 10;
            doc.text('Pegawai Pelulus', middleX, finalY);
            doc.text('(Tandatangan)', middleX, finalY + 10);
            doc.text('Nama :', middleX, finalY + 13);
            doc.text('Jawatan :', middleX, finalY + 16);
            doc.text(`Tarikh : ${new Date().toLocaleDateString('en-GB')}`, middleX, finalY + 19);

            // Right Signature (Penerima)
            // Positioned near right edge of the PANEL
            const rightX = panelRight - 30;
            doc.text('Penerima', rightX, finalY);
            doc.text('(Tandatangan)', rightX, finalY + 10);
            doc.text('Nama : ', rightX, finalY + 13);
            doc.text('Jawatan : ', rightX, finalY + 16);
            doc.text(`Tarikh : ${new Date().toLocaleDateString('en-GB')}`, rightX, finalY + 19);
        });
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
                message.success(`Successfully processed ${exportCount} PDF file(s)!`);
            } else {
                message.warning('No items to open/download.');
            }
        } catch (error) {
            console.error('Error exporting to PDF:', error);
            message.error('Failed to export to PDF');
        }
    };


    const dateFullCellRender = (value) => {
        const dateStr = value.format('YYYY-MM-DD');
        const hasIndent = datesWithIndents.includes(dateStr);

        if (hasIndent) {
            return (
                <div className="ant-picker-cell-inner">
                    <Badge dot color="#1890ff">
                        {value.date()}
                    </Badge>
                </div>
            );
        }

        return (
            <div className="ant-picker-cell-inner">
                {value.date()}
            </div>
        );
    };

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '50px' }}>
                <Spin size="large" />
            </div>
        );
    }

    const totalItems = indentItems.length;

    return (
        <div className="indent-list-page">
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {/* Header */}
                <div>
                    <Title level={3} style={{ margin: 0 }}>Previous Indents</Title>
                    <Text type="secondary">
                        View historical indent records by date
                    </Text>
                </div>

                {/* Date Selector */}
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: 300, marginBottom: 8, }}>
                        <Text strong>Select Date:</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            <Badge dot color="#1890ff" /> Dates with indent records
                        </Text>
                    </div>

                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                        <DatePicker
                            value={selectedDate}
                            onChange={(date) => setSelectedDate(date || dayjs())}
                            format="DD/MM/YYYY"
                            size="large"
                            cellRender={dateFullCellRender}
                            inputReadOnly
                            style={{
                                width: '100%', maxWidth: 300, flex: '0 1 auto', cursor: 'pointer'
                            }}
                        />
                        <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
                            <Button
                                icon={<EyeOutlined style={{ fontSize: 24 }} />}
                                onClick={() => processPDFExport('preview')}
                                disabled={totalItems === 0}
                                size="large"
                                style={{
                                    backgroundColor: totalItems === 0 ? undefined : '#9c0888ff',
                                    borderColor: totalItems === 0 ? '#d6d6d6' : '#9c0888ff',
                                    color: totalItems === 0 ? undefined : '#fff'
                                }}
                            >
                            </Button>
                            <Button
                                icon={<DownOutlined style={{ fontSize: 19 }} />}
                                onClick={() => processPDFExport('download')}
                                disabled={totalItems === 0}
                                size="large"
                                style={{
                                    backgroundColor: totalItems === 0 ? undefined : '#0050b3',
                                    borderColor: totalItems === 0 ? '#d6d6d6' : '#0050b3',
                                    color: totalItems === 0 ? undefined : '#fff'
                                }}
                            >
                                <span className="button-text">Download</span>
                            </Button>
                        </div>
                    </div>

                </div>



                {/* Results Count */}
                <Text type="secondary">
                    {totalItems} {totalItems === 1 ? 'item' : 'items'} on {selectedDate.format('DD/MM/YYYY')}
                </Text>

                {/* Empty State */}
                {totalItems === 0 && (
                    <Empty description="No indent records for this date" />
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
                                                style={{ flexWrap: 'wrap' }}
                                            >
                                                <List.Item.Meta
                                                    title={
                                                        <Space>
                                                            <Tag color={getStdKtColor(item.inventory_items?.std_kt)}>
                                                                {item.inventory_items?.std_kt}
                                                            </Tag>
                                                            <Text strong>{item.inventory_items?.name}</Text>
                                                            <Text >| {item.inventory_items?.pku}</Text>
                                                        </Space>
                                                    }
                                                    description={
                                                        <Space direction="vertical" size="small">
                                                            <Space wrap>

                                                            </Space>
                                                            <Text>Quantity: <Text strong>{item.requested_qty}</Text></Text>
                                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                                Requested Date: {dayjs(item.created_at).format('DD/MM/YYYY HH:mm')}
                                                            </Text>
                                                        </Space>
                                                    }
                                                />
                                            </List.Item>
                                        )}
                                    />
                                </Panel>
                            );
                        })}
                    </Collapse>
                )
                }
            </Space >

            {/* Responsive Styles */}
            < style > {`
                /* Mobile: responsive adjustments */

                input {
                    cursor: pointer !important;
                    user-select: none;
                }
                
                @media (max-width: 768px) {
                    .ant-collapse-header {
                        padding: 12px !important;
                    }
                    
                    .ant-space-horizontal {
                        gap: 8px !important;
                    }
                    
                    .ant-list-item {
                        padding: 12px !important;
                    }
                    
                    .export-button-container {
                        margin-top: 16px !important;
                    }
                }
                
                @media (max-width: 480px) {
                    .indent-list-page .ant-typography h3 {
                        font-size: 18px !important;
                    }
                    
                    .ant-tag {
                        font-size: 11px !important;
                        padding: 0 4px !important;
                    }
                }

                /* Date picker badge styling */
                .ant-picker-cell-inner .ant-badge {
                    width: 100%;
                }
            `}</style >
        </div >
    );
};

export default IndentListPage;
