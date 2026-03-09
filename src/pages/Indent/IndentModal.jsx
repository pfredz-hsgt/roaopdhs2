import React, { useState, useEffect, useRef } from 'react';
import {
    Modal,
    Form,
    Input,
    InputNumber,
    Select,
    Radio,
    Space,
    Typography,
    Tag,
    Button,
    message,
    Descriptions,
    Checkbox,
    DatePicker,
    Row,
    Col,
    Drawer,
} from 'antd';
import { EditOutlined, FormOutlined } from '@ant-design/icons';
import { supabase } from '../../lib/supabase';
import { getSourceColor, getPuchaseTypeColor, getStdKtColor } from '../../lib/colorMappings';
import dayjs from 'dayjs';
import CustomDateInput from '../../components/CustomDateInput';

const { Title, Text } = Typography;
const { TextArea } = Input;

const IndentModal = ({ drug, visible, onClose, onSuccess, onDrugUpdate, width = 500 }) => {
    const [form] = Form.useForm();
    const [editForm] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [balance, setBalance] = useState(null);
    const [maxQty, setMaxQty] = useState(null);
    const [indentSource, setIndentSource] = useState(null);
    const [isShortExp, setIsShortExp] = useState(false);
    const [shortExp, setShortExp] = useState(null);
    const [hasChanges, setHasChanges] = useState(false);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const quantityInputRef = useRef(null);
    const debounceRef = useRef(null);
    const [isIndentSourceDropdownOpen, setIsIndentSourceDropdownOpen] = useState(false);

    // Initialize state when drug changes
    useEffect(() => {
        if (drug) {
            setBalance(drug.balance);
            setMaxQty(drug.max_qty);
            setIndentSource(drug.indent_source);
            setIsShortExp(drug.is_short_exp || false);
            setShortExp(drug.short_exp ? dayjs(drug.short_exp) : null);
            setHasChanges(false);

            // Auto-calculate indent quantity: max_qty - balance
            const calculatedQty = calculateIndentQty(drug.max_qty, drug.balance);
            form.setFieldsValue({ quantity: calculatedQty });
        }
    }, [drug, form]);

    // Auto-focus quantity input when modal opens
    useEffect(() => {
        if (visible) {
            // Delay to ensure modal animation completes
            setTimeout(() => {
                if (quantityInputRef.current) {
                    quantityInputRef.current.focus();
                    quantityInputRef.current.select();
                }
            }, 400);
        }
    }, [visible]);





    const handleBalanceChange = (value) => {
        setBalance(value);

        // Recalculate indent quantity when balance changes
        const calculatedQty = calculateIndentQty(maxQty, value);
        form.setFieldsValue({ quantity: calculatedQty });

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setHasChanges(true);
        }, 500);
    };

    const handleMaxQtyChange = (value) => {
        setMaxQty(value);

        // Recalculate indent quantity when max qty changes
        const calculatedQty = calculateIndentQty(value, balance);
        form.setFieldsValue({ quantity: calculatedQty });

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setHasChanges(true);
        }, 500);
    };

    // Helper function to calculate indent quantity
    const calculateIndentQty = (maxQty, currentBalance) => {
        const max = parseInt(maxQty) || 0;
        const bal = parseInt(currentBalance) || 0;
        const result = max - bal;
        return result > 0 ? result.toString() : '0';
    };

    const handleIndentSourceChange = (value) => {
        setIndentSource(value);
        setIsIndentSourceDropdownOpen(false);
        if (document.activeElement) {
            document.activeElement.blur();
        }
        setHasChanges(true);
    };

    const handleShortExpChange = (e) => {
        setIsShortExp(e.target.checked);
        setHasChanges(true);
    };

    const handleShortExpDateChange = (date) => {
        setShortExp(date);
        setHasChanges(true);
    };

    const saveQuickUpdates = async () => {
        try {
            const { error } = await supabase
                .from('inventory_items')
                .update({
                    max_qty: maxQty,
                    balance: balance,
                    indent_source: indentSource,
                    is_short_exp: isShortExp,
                    short_exp: shortExp ? shortExp.format('YYYY-MM-DD') : null,
                })
                .eq('id', drug.id);

            if (error) throw error;

            message.success('Item details updated');
            setHasChanges(false);
            onClose(true)
            if (onDrugUpdate) onDrugUpdate();
        } catch (error) {
            console.error('Error updating item details:', error);
            message.error('Failed to update item details');
            throw error;
        }
    };

    const handleClose = () => {
        // Just close without saving changes
        if (debounceRef.current) clearTimeout(debounceRef.current);
        onClose(false);
    };

    const handleQuantityChange = (value) => {
        if (value === 0) {
            message.warning('Quantity must be at least 1');
        }
    };

    const handleSubmit = async (values) => {
        try {
            setLoading(true);

            // Validate quantity is not 0
            if (!values.quantity || values.quantity === 0) {
                message.error('Quantity must be at least 1');
                setLoading(false);
                return;
            }

            const { error } = await supabase
                .from('indent_requests')
                .insert({
                    item_id: drug.id,
                    requested_qty: values.quantity,
                    status: 'Pending',
                });

            if (error) throw error;
            form.resetFields();
            onSuccess();
        } catch (error) {
            console.error('Error adding to cart:', error);
            if (!error.message?.includes('item details')) {
                message.error('Failed to add item to cart');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleOpenEditModal = () => {
        editForm.setFieldsValue(drug);
        setEditModalVisible(true);
    };

    const handleEditSubmit = async (values) => {
        try {
            const { error } = await supabase
                .from('inventory_items')
                .update(values)
                .eq('id', drug.id);

            if (error) throw error;

            message.success('Drug updated successfully');
            setEditModalVisible(false);
            editForm.resetFields();
            if (onDrugUpdate) onDrugUpdate();
        } catch (error) {
            console.error('Error updating drug:', error);
            message.error('Failed to update drug');
        }
    };

    // Handle Enter key shortcut
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.defaultPrevented) return;

            if (visible && !editModalVisible && e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();

                if (hasChanges) {
                    saveQuickUpdates();
                } else {
                    form.submit();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [visible, editModalVisible, hasChanges, form, saveQuickUpdates]);

    if (!drug) return null;

    return (
        <>
            <Drawer
                open={visible}
                onClose={handleClose}
                mask={false}
                zIndex={1000}
                title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 24 }}>
                        <span>Add to Indent</span>
                        <Button
                            type="text"
                            icon={<FormOutlined />}
                            onClick={handleOpenEditModal}
                            size="small"
                        >
                            Edit
                        </Button>
                    </div>
                }
                footer={null}
                width={width}
                placement="right"
            >
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    {/* Drug Info */}
                    <div style={{ textAlign: 'center' }}>
                        <Title level={4} style={{ marginBottom: 4 }}>
                            {drug.name}
                        </Title>

                        {/* Item Code and PKU */}
                        <Space size="large" style={{ marginBottom: 12 }}>
                            {drug.item_code && (
                                <Text type="secondary" style={{ fontSize: '13px' }}>
                                    <Text strong copyable>{drug.item_code}</Text>
                                </Text>
                            )}
                            {drug.pku && (
                                <Text type="secondary" style={{ fontSize: '13px' }}>
                                    PKU: <Text strong>{drug.pku}</Text>
                                </Text>
                            )}
                        </Space> <br />

                        {/* Tags */}
                        <Space wrap style={{ marginBottom: 8, justifyContent: 'center' }}>
                            {drug.puchase_type && <Tag color={getPuchaseTypeColor(drug.puchase_type)}>{drug.puchase_type}</Tag>}
                            {drug.std_kt && <Tag color={getStdKtColor(drug.std_kt)}>{drug.std_kt}</Tag>}
                            {drug.row && <Tag>Row: {drug.row}</Tag>}
                        </Space>

                        {/* Remarks */}
                        {drug.remarks && (
                            <div style={{ marginTop: 8, padding: '8px 16px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                                <Text style={{ fontSize: '13px', fontStyle: 'italic' }} editable={{ tooltip: 'Edit Remarks', triggerType: 'text' }}>
                                    {drug.remarks}
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
                                        value={maxQty}
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
                                        value={balance}
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
                                    value={indentSource}
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

                        {/* Short Expiry */}
                        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                            <Col xs={24}>
                                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                                    Short Expiry
                                </Text>
                                <Space style={{ width: '100%' }}>
                                    <Checkbox
                                        checked={isShortExp}
                                        onChange={handleShortExpChange}
                                    >
                                        Mark as short expiry
                                    </Checkbox>
                                    {isShortExp && (
                                        <CustomDateInput
                                            value={shortExp}
                                            onChange={handleShortExpDateChange}
                                            placeholder="DDMMYY"
                                        />
                                    )}
                                </Space>
                            </Col>
                        </Row>
                    </div>

                    {/* Form */}
                    <Form
                        form={form}
                        layout="vertical"
                        onFinish={handleSubmit}
                        initialValues={{
                            quantity: '',
                        }}
                    >
                        <Form.Item
                            name="quantity"
                            label="Indent Quantity"
                            rules={[
                                { required: true, message: 'Please enter indent quantity' },
                                {
                                    validator: (_, value) => {
                                        if (value && value < 1) {
                                            return Promise.reject(new Error('Quantity must be at least 1'));
                                        }
                                        return Promise.resolve();
                                    }
                                },
                            ]}
                        >
                            <InputNumber
                                ref={quantityInputRef}
                                autoFocus
                                style={{ width: '100%' }}
                                placeholder="Enter quantity"
                                min={0}
                                size="large"
                                onChange={handleQuantityChange}
                            />
                        </Form.Item>

                        <Form.Item style={{ marginBottom: 0 }}>
                            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                                {hasChanges && (
                                    <Button
                                        onClick={saveQuickUpdates}
                                        loading={loading}
                                        type="default"
                                        style={{ borderColor: '#52c41a', color: '#52c41a' }}
                                    >
                                        Save Changes
                                    </Button>
                                )}
                                <Button onClick={handleClose}>Cancel</Button>
                                <Button type="primary" htmlType="submit" loading={loading}>
                                    Add to Cart
                                </Button>
                            </Space>
                        </Form.Item>
                    </Form>
                </Space>
            </Drawer>

            {/* Edit Drug Modal */}
            <Modal
                title="Edit Drug Details"
                open={editModalVisible}
                onCancel={() => setEditModalVisible(false)}
                onOk={() => editForm.submit()}
                width={600}
                zIndex={2000}
                centered
            >
                <Form
                    form={editForm}
                    layout="vertical"
                    onFinish={handleEditSubmit}
                >
                    <Form.Item
                        name="name"
                        label="Drug Name"
                        rules={[{ required: true, message: 'Please enter drug name' }]}
                    >
                        <Input placeholder="e.g., Paracetamol 500mg" />
                    </Form.Item>

                    <Space style={{ width: '100%' }} size="large">
                        <Form.Item name="item_code" label="Item Code">
                            <Input placeholder="e.g., ITEM001" style={{ width: 150 }} />
                        </Form.Item>

                        <Form.Item name="pku" label="PKU">
                            <Input placeholder="e.g., PKU001" style={{ width: 150 }} />
                        </Form.Item>
                    </Space>

                    <Space style={{ width: '100%' }} size="large">
                        <Form.Item name="puchase_type" label="Purchase Type">
                            <Select placeholder="Select type" style={{ width: 150 }} virtual={false}>
                                <Select.Option value="LP">LP</Select.Option>
                                <Select.Option value="APPL">APPL</Select.Option>
                            </Select>
                        </Form.Item>

                        <Form.Item name="std_kt" label="STD/KT">
                            <Select placeholder="Select" style={{ width: 150 }} virtual={false}>
                                <Select.Option value="STD">STD</Select.Option>
                                <Select.Option value="KT">KT</Select.Option>
                            </Select>
                        </Form.Item>
                    </Space>

                    <Space style={{ width: '100%' }} size="large">
                        <Form.Item name="row" label="Row">
                            <Input placeholder="e.g., A1" style={{ width: 120 }} />
                        </Form.Item>

                        <Form.Item name="max_qty" label="Max Quantity">
                            <InputNumber placeholder="Max Qty" style={{ width: 120 }} min={0} />
                        </Form.Item>

                        <Form.Item name="balance" label="Balance">
                            <InputNumber placeholder="Balance" style={{ width: 120 }} min={0} />
                        </Form.Item>
                    </Space>

                    <Form.Item name="indent_source" label="Indent Source">
                        <Select placeholder="Select source" virtual={false}>
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
                    </Form.Item>

                    <Form.Item name="remarks" label="Remarks">
                        <TextArea
                            rows={3}
                            placeholder="Any special notes or instructions..."
                        />
                    </Form.Item>
                </Form>
            </Modal>
        </>
    );
};

export default IndentModal;
