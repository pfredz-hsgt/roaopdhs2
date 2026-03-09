import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
    Row,
    Col,
    Skeleton,
    Empty,
    Space,
    Button,
    Typography,
    message,
    Pagination,
    Input,
    List,
    Tag,
    Select,
    Table,
    Grid,
} from 'antd';
import {
    SearchOutlined,
    UnorderedListOutlined,
    TableOutlined,
} from '@ant-design/icons';
import { supabase } from '../../lib/supabase';
import { getSourceColor, getPuchaseTypeColor, getStdKtColor } from '../../lib/colorMappings';
import IndentModal from './IndentModal';
import DebouncedSearchInput from '../../components/DebouncedSearchInput';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const DRAWER_WIDTH = 500;

// Memoized list item component to prevent unnecessary re-renders
const DrugListItem = React.memo(({ drug, onClick }) => {
    return (
        <List.Item style={{ marginBottom: 8 }}>
            <div
                className="drug-card"
                onClick={() => onClick(drug)}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <Text strong style={{ fontSize: '14px', display: 'block', marginBottom: '8px' }}>
                            {drug.name}
                        </Text>
                        <Space wrap size={[4, 4]} style={{ marginBottom: '8px' }}>
                            {drug.puchase_type && (
                                <Tag color={getPuchaseTypeColor(drug.puchase_type)} style={{ margin: 0, fontSize: '11px' }}>
                                    {drug.puchase_type}
                                </Tag>
                            )}
                            {drug.std_kt && (
                                <Tag color={getStdKtColor(drug.std_kt)} style={{ margin: 0, fontSize: '11px' }}>
                                    {drug.std_kt}
                                </Tag>
                            )}
                            {drug.indent_source && (
                                <Tag color={getSourceColor(drug.indent_source)} style={{ margin: 0, fontSize: '11px' }}>
                                    {drug.indent_source}
                                </Tag>
                            )}
                        </Space>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <Text type="secondary" style={{ fontSize: '12px' }}>
                                <Text style={{ fontStyle: 'italic', fontSize: '12px' }}>{drug.pku || ''}</Text>
                            </Text><br />
                            <Text type="secondary" style={{ fontSize: '12px' }}>
                                Max: <Text strong style={{ fontSize: '12px' }}>{drug.max_qty || ''}</Text>
                            </Text>
                            <Text type="secondary" style={{ fontSize: '12px' }}>
                                Bal: <Text strong style={{ fontSize: '12px' }}>{drug.balance || ''}</Text>
                            </Text>
                        </div>
                        {drug.remarks && (
                            <Text
                                type="secondary"
                                style={{
                                    fontSize: '12px',
                                    display: 'block',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                }}
                                title={drug.remarks}
                            >
                                {drug.remarks}
                            </Text>
                        )}
                    </div>
                </div>
            </div>
        </List.Item>
    );
});

DrugListItem.displayName = 'DrugListItem';

const IndentPage = () => {
    const screens = useBreakpoint();
    const isDesktop = screens.lg;
    const [drugs, setDrugs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDrug, setSelectedDrug] = useState(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [indentRows, setIndentRows] = useState([]);
    const [selectedIndentRow, setSelectedIndentRow] = useState('ALL');
    const [indentSources, setIndentSources] = useState([]);
    const [selectedIndentSource, setSelectedIndentSource] = useState('ALL');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState(isDesktop ? 'table' : 'list');
    const debounceTimerRef = useRef(null);

    useEffect(() => {
        setViewMode(isDesktop ? 'table' : 'list');
    }, [isDesktop]);



    useEffect(() => {
        fetchDrugs();
        setupRealtimeSubscription();
    }, []);

    // Reset to first page when search query changes or indent source changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, selectedIndentRow, selectedIndentSource]);

    const fetchDrugs = useCallback(async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('inventory_items')
                .select('*')
                .order('name', { ascending: true });

            if (error) throw error;

            setDrugs(data || []);

            // Extract unique indent rows
            const uniqueRows = [...new Set(data.map(d => d.row).filter(Boolean))].sort();
            setIndentRows(uniqueRows);

            // Extract unique indent sources
            const uniqueSources = [...new Set(data.map(d => d.indent_source).filter(Boolean))].sort();
            setIndentSources(uniqueSources);
        } catch (error) {
            console.error('Error fetching drugs:', error);
            message.error('Failed to load inventory items');
        } finally {
            setLoading(false);
        }
    }, []);

    // Debounced fetch to prevent excessive refetching
    const debouncedFetchDrugs = useCallback(() => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(() => {
            fetchDrugs();
        }, 1000); // Wait 1 second before refetching
    }, [fetchDrugs]);

    const setupRealtimeSubscription = () => {
        const subscription = supabase
            .channel('inventory_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'inventory_items',
                },
                (payload) => {
                    console.log('Realtime update:', payload);
                    debouncedFetchDrugs(); // Use debounced refresh
                }
            )
            .subscribe();

        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
            subscription.unsubscribe();
        };
    };

    // Memoize filtered drugs to prevent unnecessary recalculations
    const filteredDrugs = useMemo(() => {
        let result = drugs;

        // Filter by indent row
        if (selectedIndentRow !== 'ALL') {
            result = result.filter(drug => drug.row === selectedIndentRow);
        }

        // Filter by indent source
        if (selectedIndentSource !== 'ALL') {
            result = result.filter(drug => drug.indent_source === selectedIndentSource);
        }

        // Filter by search query
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(drug =>
                drug.name?.toLowerCase().includes(query) ||
                drug.item_code?.toLowerCase().includes(query) ||
                drug.pku?.toLowerCase().includes(query) ||
                drug.row?.toLowerCase().includes(query)
            );
        }

        return result;
    }, [searchQuery, selectedIndentRow, selectedIndentSource, drugs]);

    // Memoize paginated drugs
    const paginatedDrugs = useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        return filteredDrugs.slice(startIndex, endIndex);
    }, [filteredDrugs, currentPage, pageSize]);

    // Use useCallback to prevent unnecessary re-renders
    const handleDrugClick = useCallback((drug) => {
        setSelectedDrug(drug);
        setModalVisible(true);
    }, []);

    const handlePageChange = useCallback((page, newPageSize) => {
        setCurrentPage(page);
        if (newPageSize !== pageSize) {
            setPageSize(newPageSize);
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [pageSize]);

    const handleIndentSuccess = useCallback(() => {
        setModalVisible(false);
        message.success('Item added to cart successfully!');
    }, []);

    const columns = [

        {
            title: 'Item Code',
            dataIndex: 'item_code',
            key: 'item_code',
            width: 120,
            align: 'center',
            render: (text) => (
                <Text style={{ fontSize: '12px', color: '#cccccc' }}>{text}</Text>
            ),
        },
        {
            title: 'Name',
            dataIndex: 'name',
            key: 'name',
            sorter: (a, b) => a.name.localeCompare(b.name),
            width: 300,
        },
        {
            title: 'PKU',
            dataIndex: 'pku',
            key: 'pku',
            width: 120,
            align: 'center',
        },
        {
            title: 'Purchase Type',
            dataIndex: 'puchase_type',
            key: 'puchase_type',
            width: 120,
            align: 'center',
            filters: [
                { text: 'LP', value: 'LP' },
                { text: 'APPL', value: 'APPL' },
            ],
            onFilter: (value, record) => record.puchase_type === value,
            render: (type) => type && (
                <Tag style={{ fontSize: '14px' }} color={getPuchaseTypeColor(type)}>
                    {type}
                </Tag>
            ),
        },
        {
            title: 'STD/KT',
            dataIndex: 'std_kt',
            key: 'std_kt',
            width: 100,
            align: 'center',
            filters: [
                { text: 'STD', value: 'STD' },
                { text: 'KT', value: 'KT' },
            ],
            onFilter: (value, record) => record.std_kt === value,
            render: (type) => type && (
                <Tag style={{ fontSize: '14px' }} color={getStdKtColor(type)}>
                    {type}
                </Tag>
            ),
        },
        {
            title: 'Row',
            dataIndex: 'row',
            key: 'row',
            width: 100,
            align: 'center',
        },
        {
            title: 'Max Qty',
            dataIndex: 'max_qty',
            key: 'max_qty',
            width: 100,
            responsive: ['md'],
            align: 'center',
        },
        {
            title: 'Balance',
            dataIndex: 'balance',
            key: 'balance',
            width: 100,
            responsive: ['md'],
            align: 'center',
        },
        {
            title: 'Source',
            dataIndex: 'indent_source',
            key: 'indent_source',
            width: 120,
            align: 'center',
            render: (source) => source && (
                <Tag style={{ fontSize: '14px' }} color={getSourceColor(source)}>
                    {source}
                </Tag>
            ),
        },
        {
            title: 'Remarks',
            dataIndex: 'remarks',
            key: 'remarks',
            ellipsis: true,
            render: (text) => (
                <Text style={{ fontSize: '14px' }}>{text}</Text>
            ),
        },
    ];

    return (
        <>
            <div style={{
                marginRight: (modalVisible && isDesktop) ? DRAWER_WIDTH : 0,
                transition: 'margin-right 0.3s ease',
            }}>
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    {/* Header */}
                    <div>
                        <Title level={3}>Indent Management</Title>
                        <Text type="secondary">
                            Select items to add to your indent cart
                        </Text>
                    </div>



                    {/* Search Bar and View Toggle */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                        <DebouncedSearchInput
                            placeholder="Search by name, item code, PKU, or row..."
                            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                            onSearch={setSearchQuery}
                            allowClear
                            size="large"
                            style={{ flex: '1 1 300px', minWidth: '200px' }}
                        />
                        <Select
                            placeholder="Filter by Row"
                            style={{ width: 180 }}
                            size="large"
                            allowClear
                            value={selectedIndentRow === 'ALL' ? null : selectedIndentRow}
                            onChange={(value) => setSelectedIndentRow(value || 'ALL')}
                        >
                            {indentRows.map(row => (
                                <Select.Option key={row} value={row}>
                                    {row}
                                </Select.Option>
                            ))}
                        </Select>
                        <Select
                            placeholder="Filter by Source"
                            style={{ width: 180 }}
                            size="large"
                            allowClear
                            value={selectedIndentSource === 'ALL' ? null : selectedIndentSource}
                            onChange={(value) => setSelectedIndentSource(value || 'ALL')}
                        >
                            {indentSources.map(source => (
                                <Select.Option key={source} value={source}>
                                    {source}
                                </Select.Option>
                            ))}
                        </Select>
                        <Space>
                            <Button
                                type={viewMode === 'list' ? 'primary' : 'default'}
                                icon={<UnorderedListOutlined />}
                                onClick={() => setViewMode('list')}
                            />
                            <Button
                                type={viewMode === 'table' ? 'primary' : 'default'}
                                icon={<TableOutlined />}
                                onClick={() => setViewMode('table')}
                            />
                        </Space>
                    </div>

                    {/* Loading State */}
                    {loading && (
                        <Row gutter={[16, 16]}>
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <Col xs={24} sm={12} md={8} lg={6} key={i}>
                                    <Skeleton active />
                                </Col>
                            ))}
                        </Row>
                    )}

                    {/* Empty State */}
                    {!loading && filteredDrugs.length === 0 && (
                        <Empty description="No drugs in this section" />
                    )}

                    {/* Table View */}
                    {!loading && filteredDrugs.length > 0 && viewMode === 'table' && (
                        <Table
                            columns={columns}
                            dataSource={paginatedDrugs}
                            rowKey="id"
                            showSorterTooltip={false}
                            pagination={{
                                current: currentPage,
                                pageSize: pageSize,
                                total: filteredDrugs.length,
                                onChange: handlePageChange,
                                showSizeChanger: true,
                                showTotal: (total) => `Total ${total} items`,
                                pageSizeOptions: ['25', '50', '100', '200'],
                            }}
                            onRow={(record) => ({
                                onClick: () => handleDrugClick(record),
                                style: { cursor: 'pointer' },
                            })}
                            scroll={{ x: 1000 }}
                        />
                    )}

                    {/* List View */}
                    {!loading && filteredDrugs.length > 0 && viewMode === 'list' && (
                        <List
                            grid={{
                                gutter: 16,
                                xs: 1,
                                sm: 1,
                                md: 2,
                                lg: 2,
                                xl: 3,
                                xxl: 3,
                            }}
                            dataSource={paginatedDrugs}
                            pagination={{
                                current: currentPage,
                                pageSize: pageSize,
                                total: filteredDrugs.length,
                                onChange: handlePageChange,
                                onShowSizeChange: handlePageChange,
                                showSizeChanger: true,
                                showTotal: (total) => `Total ${total} items`,
                                pageSizeOptions: ['25', '50', '100', '200'],
                            }}
                            renderItem={(drug) => (
                                <DrugListItem drug={drug} onClick={handleDrugClick} />
                            )}
                        />
                    )}
                </Space>

                {/* Indent Modal */}
                <IndentModal
                    drug={selectedDrug}
                    visible={modalVisible}
                    onClose={(shouldRefresh) => {
                        setModalVisible(false);
                        if (shouldRefresh) {
                            fetchDrugs();
                        }
                    }}
                    onSuccess={handleIndentSuccess}
                    onDrugUpdate={fetchDrugs}
                />
            </div>

            {/* CSS for hover effects */}
            <style>{`
                .drug-card {
                    cursor: pointer;
                    padding: 12px;
                    border: 1px solid #f0f0f0;
                    border-radius: 8px;
                    transition: all 0.3s ease;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                }
                
                .drug-card:hover {
                    border-color: #1890ff;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                }
                
                .drug-card:active {
                    transform: scale(0.98);
                }
            `}</style>
        </>
    );
};

export default IndentPage;
