import React, { useState, useEffect } from 'react';
import { Input } from 'antd';

const DebouncedSearchInput = ({ onSearch, delay = 300, value: parentValue, ...props }) => {
    const [localValue, setLocalValue] = useState(parentValue || '');

    // Sync with parent value if it changes (optional, but good for controlled behavior if needed)
    useEffect(() => {
        if (parentValue !== undefined) {
            setLocalValue(parentValue);
        }
    }, [parentValue]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (onSearch) {
                onSearch(localValue);
            }
        }, delay);

        return () => clearTimeout(timer);
    }, [localValue, delay, onSearch]);

    const handleChange = (e) => {
        setLocalValue(e.target.value);
    };

    return (
        <Input
            {...props}
            value={localValue}
            onChange={handleChange}
        />
    );
};

export default DebouncedSearchInput;
