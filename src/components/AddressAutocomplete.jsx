import React, { useState, useEffect, useRef } from 'react';
import { MapPin } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

const AddressAutocomplete = ({ value, onChange, placeholder = "Enter location" }) => {
    const [query, setQuery] = useState(value || '');
    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const wrapperRef = useRef(null);
    const debounceTimeout = useRef(null);

    useEffect(() => {
        setQuery(value || '');
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const searchAddress = async (searchText) => {
        if (!searchText.trim() || searchText.length < 3) {
            setResults([]);
            setShowDropdown(false);
            return;
        }

        setIsLoading(true);
        try {
            // Add a country code filter or generic query. OpenStreetMap Nominatim is free.
            // Using US for defaults based on the mock data
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchText)}&countrycodes=us&addressdetails=1&limit=5`, {
                headers: {
                    'Accept-Language': 'en-US,en;q=0.9',
                }
            });
            const data = await response.json();

            // Format nice display names
            const formattedResults = data.map(item => {
                // Shorten the long OSM display names to look more like typical addresses
                const parts = item.display_name.split(', ');
                let shortName = item.display_name;

                if (parts.length >= 3) {
                    if (item.address && item.address.house_number && item.address.road) {
                        const street = `${item.address.house_number} ${item.address.road}`;
                        const city = item.address.city || item.address.town || item.address.village || '';
                        const state = item.address.state || '';
                        shortName = `${street}, ${city}, ${state}`.replace(/(^, )|(, $)/g, '').replace(/, ,/g, ',');
                    } else if (parts.length > 3) {
                        shortName = `${parts[0]}, ${parts[1]}, ${parts[parts.length - 2]}`;
                    }
                }

                return {
                    id: item.place_id,
                    displayName: shortName,
                    originalName: item.display_name,
                    lat: parseFloat(item.lat),
                    lon: parseFloat(item.lon)
                };
            });

            setResults(formattedResults);
            setShowDropdown(true);
        } catch (error) {
            console.error('Error fetching address:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const newValue = e.target.value;
        setQuery(newValue);
        onChange(newValue); // Keep parent in sync even if not selected from dropdown

        if (debounceTimeout.current) clearTimeout(debounceTimeout.current);

        debounceTimeout.current = setTimeout(() => {
            searchAddress(newValue);
        }, 500); // 500ms debounce to be polite to the free OSM API
    };

    const handleSelect = (address) => {
        setQuery(address.displayName);
        onChange(address.displayName, address.lat, address.lon);
        setShowDropdown(false);
    };

    return (
        <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
            <div style={{ position: 'relative' }}>
                <input
                    type="text"
                    className="input-field"
                    placeholder={placeholder}
                    value={query}
                    onChange={handleInputChange}
                    onFocus={() => {
                        if (results.length > 0) setShowDropdown(true);
                    }}
                    style={{ width: '100%', paddingLeft: '2.5rem', marginBottom: 0 }}
                />
                <MapPin
                    size={16}
                    style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}
                />
                {isLoading && (
                    <div style={{
                        position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)'
                    }}>
                        <LoadingSpinner fullScreen={false} size="14px" />
                    </div>
                )}
            </div>

            {showDropdown && results.length > 0 && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '4px',
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    zIndex: 1000,
                    maxHeight: '200px',
                    overflowY: 'auto'
                }}>
                    {results.map((result) => (
                        <div
                            key={result.id}
                            onClick={() => handleSelect(result)}
                            style={{
                                padding: '0.8rem 1rem',
                                cursor: 'pointer',
                                borderBottom: '1px solid var(--border)',
                                fontSize: '0.9rem',
                                color: 'var(--text-primary)',
                                transition: 'background-color 0.2s',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-hover)'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                            {result.displayName}
                        </div>
                    ))}
                </div>
            )}

            <style>{`
                @keyframes spin { 100% { transform: translateY(-50%) rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default AddressAutocomplete;
