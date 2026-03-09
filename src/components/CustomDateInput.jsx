import React from 'react';
import { DatePicker } from 'antd';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

// This plugin is needed for dayjs to correctly handle an array of formats.
dayjs.extend(customParseFormat);

const CustomDateInput = (props) => {
  // Define the date formats you want to support.
  const supportedFormats = ['DD/MM/YYYY', 'DDMMYY'];

  return (
    <DatePicker
      // Pass through all the props from the parent (like value, onChange, style, etc.)
      {...props}
      // Add or override the format prop with our supported formats.
      format={supportedFormats}
      // Set a default placeholder if one isn't provided.
      placeholder={props.placeholder || "Select date or enter DDMMYY"}
    />
  );
};

export default CustomDateInput;