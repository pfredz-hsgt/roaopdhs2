import React, { useState } from 'react';
import { Tabs, Typography, Button, message } from 'antd';
import { DatabaseOutlined, CloudUploadOutlined, DownloadOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import InventoryTable from './InventoryTable';

const { Title, Text } = Typography;

const SettingsPage = () => {
    const [activeTab, setActiveTab] = useState('inventory');
    const [exporting, setExporting] = useState(false);

    const handleExport = async () => {
        try {
            setExporting(true);
            message.loading({ content: 'Exporting data...', key: 'export' });

            // Fetch Inventory
            const { data: inventoryData, error: inventoryError } = await supabase
                .from('inventory_items')
                .select('*');
            if (inventoryError) throw inventoryError;

            // Fetch Indents with related item name
            const { data: indentData, error: indentError } = await supabase
                .from('indent_requests')
                .select('*, inventory_items(name)');
            if (indentError) throw indentError;

            // Create Workbook
            const wb = XLSX.utils.book_new();

            // Add Inventory Sheet
            if (inventoryData && inventoryData.length > 0) {
                const wsInventory = XLSX.utils.json_to_sheet(inventoryData);
                XLSX.utils.book_append_sheet(wb, wsInventory, "Inventory");
            }

            // Add Indents Sheet
            if (indentData && indentData.length > 0) {
                // Flatten the data for better Excel display
                const flatIndentData = indentData.map(item => ({
                    ...item,
                    drug_name: item.inventory_items?.name || 'Unknown',
                    inventory_items: undefined // Remove the nested object
                }));
                const wsIndents = XLSX.utils.json_to_sheet(flatIndentData);
                XLSX.utils.book_append_sheet(wb, wsIndents, "Indents");
            }

            // Write File
            XLSX.writeFile(wb, `PIMS_Export_${new Date().toISOString().split('T')[0]}.xlsx`);

            message.success({ content: 'Data exported successfully!', key: 'export' });
        } catch (error) {
            console.error('Export error:', error);
            message.error({ content: 'Failed to export data', key: 'export' });
        } finally {
            setExporting(false);
        }
    };

    const items = [
        {
            key: 'inventory',
            label: (
                <span>
                    <DatabaseOutlined />
                    Inventory Management
                </span>
            ),
            children: <InventoryTable />,
        },
    ];

    return (
        <div>
            <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <Title level={3}>Settings</Title>
                    <Text type="secondary">
                        Manage inventory items and upload drug images
                    </Text>
                </div>
                <Button
                    type="primary"
                    icon={<DownloadOutlined />}
                    onClick={handleExport}
                    loading={exporting}
                >
                    Export All Data
                </Button>
            </div>

            <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                items={items}
            />
        </div>
    );
};

export default SettingsPage;
