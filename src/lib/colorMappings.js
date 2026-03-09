// Color mapping functions for indent sources and new schema fields
// Use these consistently across all components

// Source colors – all clearly separated hues
export const getSourceColor = (source) => {
    const colors = {
        'OPD Kaunter': 'green',
        'OPD Substor': 'cyan',
        'IPD Kaunter': 'geekblue',
        'IPD Substor': 'blue',
        'MNF Substor': 'volcano',
        'MNF Eksternal': 'magenta',
        'MNF Internal': 'orange',
        'Prepacking': 'purple',
        'HPSF Muar': 'gold',
    };
    return colors[source] || 'default';
};

// Purchase type – no overlap with source meanings
export const getPuchaseTypeColor = (type) => {
    const colors = {
        'LP': 'gold',        // Local Purchase
        'APPL': 'geekblue',  // Contract / Approved list
    };
    return colors[type] || 'default';
};

// Item flow type – strong semantic contrast
export const getStdKtColor = (type) => {
    const colors = {
        'STD': 'green', // Standard
        'KT': 'red',    // Keluar Terus (Direct Issue)
    };
    return colors[type] || 'default';
};
