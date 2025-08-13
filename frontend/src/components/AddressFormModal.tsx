import React, { useState } from 'react';
import { X } from 'lucide-react';

export interface AddressData {
  // Billing Address (also used for shipping)
  billingAddress: {
    firstName: string;
    lastName: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  // Tax Information
  gstin?: string;
}

interface AddressFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (addressData: AddressData) => void;
  isLoading?: boolean;
}

const COUNTRIES = [
  { code: 'AD', name: 'Andorra' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'AF', name: 'Afghanistan' },
  { code: 'AG', name: 'Antigua and Barbuda' },
  { code: 'AI', name: 'Anguilla' },
  { code: 'AL', name: 'Albania' },
  { code: 'AM', name: 'Armenia' },
  { code: 'AO', name: 'Angola' },
  { code: 'AQ', name: 'Antarctica' },
  { code: 'AR', name: 'Argentina' },
  { code: 'AS', name: 'American Samoa' },
  { code: 'AT', name: 'Austria' },
  { code: 'AU', name: 'Australia' },
  { code: 'AW', name: 'Aruba' },
  { code: 'AX', name: 'Åland Islands' },
  { code: 'AZ', name: 'Azerbaijan' },
  { code: 'BA', name: 'Bosnia and Herzegovina' },
  { code: 'BB', name: 'Barbados' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'BE', name: 'Belgium' },
  { code: 'BF', name: 'Burkina Faso' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'BH', name: 'Bahrain' },
  { code: 'BI', name: 'Burundi' },
  { code: 'BJ', name: 'Benin' },
  { code: 'BL', name: 'Saint Barthélemy' },
  { code: 'BM', name: 'Bermuda' },
  { code: 'BN', name: 'Brunei' },
  { code: 'BO', name: 'Bolivia' },
  { code: 'BQ', name: 'Caribbean Netherlands' },
  { code: 'BR', name: 'Brazil' },
  { code: 'BS', name: 'Bahamas' },
  { code: 'BT', name: 'Bhutan' },
  { code: 'BV', name: 'Bouvet Island' },
  { code: 'BW', name: 'Botswana' },
  { code: 'BY', name: 'Belarus' },
  { code: 'BZ', name: 'Belize' },
  { code: 'CA', name: 'Canada' },
  { code: 'CC', name: 'Cocos (Keeling) Islands' },
  { code: 'CD', name: 'Democratic Republic of the Congo' },
  { code: 'CF', name: 'Central African Republic' },
  { code: 'CG', name: 'Republic of the Congo' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'CI', name: 'Côte d\'Ivoire' },
  { code: 'CK', name: 'Cook Islands' },
  { code: 'CL', name: 'Chile' },
  { code: 'CM', name: 'Cameroon' },
  { code: 'CN', name: 'China' },
  { code: 'CO', name: 'Colombia' },
  { code: 'CR', name: 'Costa Rica' },
  { code: 'CU', name: 'Cuba' },
  { code: 'CV', name: 'Cape Verde' },
  { code: 'CW', name: 'Curaçao' },
  { code: 'CX', name: 'Christmas Island' },
  { code: 'CY', name: 'Cyprus' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'DE', name: 'Germany' },
  { code: 'DJ', name: 'Djibouti' },
  { code: 'DK', name: 'Denmark' },
  { code: 'DM', name: 'Dominica' },
  { code: 'DO', name: 'Dominican Republic' },
  { code: 'DZ', name: 'Algeria' },
  { code: 'EC', name: 'Ecuador' },
  { code: 'EE', name: 'Estonia' },
  { code: 'EG', name: 'Egypt' },
  { code: 'EH', name: 'Western Sahara' },
  { code: 'ER', name: 'Eritrea' },
  { code: 'ES', name: 'Spain' },
  { code: 'ET', name: 'Ethiopia' },
  { code: 'FI', name: 'Finland' },
  { code: 'FJ', name: 'Fiji' },
  { code: 'FK', name: 'Falkland Islands' },
  { code: 'FM', name: 'Micronesia' },
  { code: 'FO', name: 'Faroe Islands' },
  { code: 'FR', name: 'France' },
  { code: 'GA', name: 'Gabon' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'GD', name: 'Grenada' },
  { code: 'GE', name: 'Georgia' },
  { code: 'GF', name: 'French Guiana' },
  { code: 'GG', name: 'Guernsey' },
  { code: 'GH', name: 'Ghana' },
  { code: 'GI', name: 'Gibraltar' },
  { code: 'GL', name: 'Greenland' },
  { code: 'GM', name: 'Gambia' },
  { code: 'GN', name: 'Guinea' },
  { code: 'GP', name: 'Guadeloupe' },
  { code: 'GQ', name: 'Equatorial Guinea' },
  { code: 'GR', name: 'Greece' },
  { code: 'GS', name: 'South Georgia and the South Sandwich Islands' },
  { code: 'GT', name: 'Guatemala' },
  { code: 'GU', name: 'Guam' },
  { code: 'GW', name: 'Guinea-Bissau' },
  { code: 'GY', name: 'Guyana' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'HM', name: 'Heard Island and McDonald Islands' },
  { code: 'HN', name: 'Honduras' },
  { code: 'HR', name: 'Croatia' },
  { code: 'HT', name: 'Haiti' },
  { code: 'HU', name: 'Hungary' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IL', name: 'Israel' },
  { code: 'IM', name: 'Isle of Man' },
  { code: 'IN', name: 'India' },
  { code: 'IO', name: 'British Indian Ocean Territory' },
  { code: 'IQ', name: 'Iraq' },
  { code: 'IR', name: 'Iran' },
  { code: 'IS', name: 'Iceland' },
  { code: 'IT', name: 'Italy' },
  { code: 'JE', name: 'Jersey' },
  { code: 'JM', name: 'Jamaica' },
  { code: 'JO', name: 'Jordan' },
  { code: 'JP', name: 'Japan' },
  { code: 'KE', name: 'Kenya' },
  { code: 'KG', name: 'Kyrgyzstan' },
  { code: 'KH', name: 'Cambodia' },
  { code: 'KI', name: 'Kiribati' },
  { code: 'KM', name: 'Comoros' },
  { code: 'KN', name: 'Saint Kitts and Nevis' },
  { code: 'KP', name: 'North Korea' },
  { code: 'KR', name: 'South Korea' },
  { code: 'KW', name: 'Kuwait' },
  { code: 'KY', name: 'Cayman Islands' },
  { code: 'KZ', name: 'Kazakhstan' },
  { code: 'LA', name: 'Laos' },
  { code: 'LB', name: 'Lebanon' },
  { code: 'LC', name: 'Saint Lucia' },
  { code: 'LI', name: 'Liechtenstein' },
  { code: 'LK', name: 'Sri Lanka' },
  { code: 'LR', name: 'Liberia' },
  { code: 'LS', name: 'Lesotho' },
  { code: 'LT', name: 'Lithuania' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'LV', name: 'Latvia' },
  { code: 'LY', name: 'Libya' },
  { code: 'MA', name: 'Morocco' },
  { code: 'MC', name: 'Monaco' },
  { code: 'MD', name: 'Moldova' },
  { code: 'ME', name: 'Montenegro' },
  { code: 'MF', name: 'Saint Martin' },
  { code: 'MG', name: 'Madagascar' },
  { code: 'MH', name: 'Marshall Islands' },
  { code: 'MK', name: 'North Macedonia' },
  { code: 'ML', name: 'Mali' },
  { code: 'MM', name: 'Myanmar' },
  { code: 'MN', name: 'Mongolia' },
  { code: 'MO', name: 'Macao' },
  { code: 'MP', name: 'Northern Mariana Islands' },
  { code: 'MQ', name: 'Martinique' },
  { code: 'MR', name: 'Mauritania' },
  { code: 'MS', name: 'Montserrat' },
  { code: 'MT', name: 'Malta' },
  { code: 'MU', name: 'Mauritius' },
  { code: 'MV', name: 'Maldives' },
  { code: 'MW', name: 'Malawi' },
  { code: 'MX', name: 'Mexico' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'MZ', name: 'Mozambique' },
  { code: 'NA', name: 'Namibia' },
  { code: 'NC', name: 'New Caledonia' },
  { code: 'NE', name: 'Niger' },
  { code: 'NF', name: 'Norfolk Island' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'NI', name: 'Nicaragua' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'NO', name: 'Norway' },
  { code: 'NP', name: 'Nepal' },
  { code: 'NR', name: 'Nauru' },
  { code: 'NU', name: 'Niue' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'OM', name: 'Oman' },
  { code: 'PA', name: 'Panama' },
  { code: 'PE', name: 'Peru' },
  { code: 'PF', name: 'French Polynesia' },
  { code: 'PG', name: 'Papua New Guinea' },
  { code: 'PH', name: 'Philippines' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'PL', name: 'Poland' },
  { code: 'PM', name: 'Saint Pierre and Miquelon' },
  { code: 'PN', name: 'Pitcairn' },
  { code: 'PR', name: 'Puerto Rico' },
  { code: 'PS', name: 'Palestine' },
  { code: 'PT', name: 'Portugal' },
  { code: 'PW', name: 'Palau' },
  { code: 'PY', name: 'Paraguay' },
  { code: 'QA', name: 'Qatar' },
  { code: 'RE', name: 'Réunion' },
  { code: 'RO', name: 'Romania' },
  { code: 'RS', name: 'Serbia' },
  { code: 'RU', name: 'Russia' },
  { code: 'RW', name: 'Rwanda' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'SB', name: 'Solomon Islands' },
  { code: 'SC', name: 'Seychelles' },
  { code: 'SD', name: 'Sudan' },
  { code: 'SE', name: 'Sweden' },
  { code: 'SG', name: 'Singapore' },
  { code: 'SH', name: 'Saint Helena' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'SJ', name: 'Svalbard and Jan Mayen' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'SL', name: 'Sierra Leone' },
  { code: 'SM', name: 'San Marino' },
  { code: 'SN', name: 'Senegal' },
  { code: 'SO', name: 'Somalia' },
  { code: 'SR', name: 'Suriname' },
  { code: 'SS', name: 'South Sudan' },
  { code: 'ST', name: 'São Tomé and Príncipe' },
  { code: 'SV', name: 'El Salvador' },
  { code: 'SX', name: 'Sint Maarten' },
  { code: 'SY', name: 'Syria' },
  { code: 'SZ', name: 'Eswatini' },
  { code: 'TC', name: 'Turks and Caicos Islands' },
  { code: 'TD', name: 'Chad' },
  { code: 'TF', name: 'French Southern Territories' },
  { code: 'TG', name: 'Togo' },
  { code: 'TH', name: 'Thailand' },
  { code: 'TJ', name: 'Tajikistan' },
  { code: 'TK', name: 'Tokelau' },
  { code: 'TL', name: 'Timor-Leste' },
  { code: 'TM', name: 'Turkmenistan' },
  { code: 'TN', name: 'Tunisia' },
  { code: 'TO', name: 'Tonga' },
  { code: 'TR', name: 'Turkey' },
  { code: 'TT', name: 'Trinidad and Tobago' },
  { code: 'TV', name: 'Tuvalu' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'TZ', name: 'Tanzania' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'UG', name: 'Uganda' },
  { code: 'UM', name: 'United States Minor Outlying Islands' },
  { code: 'US', name: 'United States' },
  { code: 'UY', name: 'Uruguay' },
  { code: 'UZ', name: 'Uzbekistan' },
  { code: 'VA', name: 'Vatican City' },
  { code: 'VC', name: 'Saint Vincent and the Grenadines' },
  { code: 'VE', name: 'Venezuela' },
  { code: 'VG', name: 'British Virgin Islands' },
  { code: 'VI', name: 'U.S. Virgin Islands' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'VU', name: 'Vanuatu' },
  { code: 'WF', name: 'Wallis and Futuna' },
  { code: 'WS', name: 'Samoa' },
  { code: 'YE', name: 'Yemen' },
  { code: 'YT', name: 'Mayotte' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'ZM', name: 'Zambia' },
  { code: 'ZW', name: 'Zimbabwe' }
];

// States/Provinces data for countries with predefined lists
const STATES_BY_COUNTRY: { [key: string]: string[] } = {
  // India
  IN: [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 
    'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
    'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Madhya Pradesh', 'Maharashtra', 
    'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 
    'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 
    'Uttarakhand', 'West Bengal'
  ],
  
  // United States
  US: [
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 
    'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 
    'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 
    'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 
    'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 
    'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 
    'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 
    'Wisconsin', 'Wyoming', 'District of Columbia'
  ],
  
  // Canada
  CA: [
    'Alberta', 'British Columbia', 'Manitoba', 'New Brunswick', 'Newfoundland and Labrador',
    'Northwest Territories', 'Nova Scotia', 'Nunavut', 'Ontario', 'Prince Edward Island',
    'Quebec', 'Saskatchewan', 'Yukon'
  ],
  
  // Australia
  AU: [
    'Australian Capital Territory', 'New South Wales', 'Northern Territory', 'Queensland',
    'South Australia', 'Tasmania', 'Victoria', 'Western Australia'
  ],
  
  // United Kingdom
  GB: [
    'England', 'Scotland', 'Wales', 'Northern Ireland'
  ],
  
  // Germany
  DE: [
    'Baden-Württemberg', 'Bavaria', 'Berlin', 'Brandenburg', 'Bremen', 'Hamburg',
    'Hesse', 'Lower Saxony', 'Mecklenburg-Vorpommern', 'North Rhine-Westphalia',
    'Rhineland-Palatinate', 'Saarland', 'Saxony', 'Saxony-Anhalt', 'Schleswig-Holstein',
    'Thuringia'
  ],
  
  // Brazil
  BR: [
    'Acre', 'Alagoas', 'Amapá', 'Amazonas', 'Bahia', 'Ceará', 'Distrito Federal',
    'Espírito Santo', 'Goiás', 'Maranhão', 'Mato Grosso', 'Mato Grosso do Sul',
    'Minas Gerais', 'Pará', 'Paraíba', 'Paraná', 'Pernambuco', 'Piauí',
    'Rio de Janeiro', 'Rio Grande do Norte', 'Rio Grande do Sul', 'Rondônia',
    'Roraima', 'Santa Catarina', 'São Paulo', 'Sergipe', 'Tocantins'
  ],
  
  // Mexico
  MX: [
    'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas',
    'Chihuahua', 'Coahuila', 'Colima', 'Durango', 'Guanajuato', 'Guerrero',
    'Hidalgo', 'Jalisco', 'México', 'Michoacán', 'Morelos', 'Nayarit', 'Nuevo León',
    'Oaxaca', 'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí', 'Sinaloa',
    'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas'
  ],
  
  // France
  FR: [
    'Auvergne-Rhône-Alpes', 'Bourgogne-Franche-Comté', 'Bretagne', 'Centre-Val de Loire',
    'Corse', 'Grand Est', 'Hauts-de-France', 'Île-de-France', 'Normandie',
    'Nouvelle-Aquitaine', 'Occitanie', 'Pays de la Loire', 'Provence-Alpes-Côte d\'Azur'
  ],
  
  // Italy
  IT: [
    'Abruzzo', 'Basilicata', 'Calabria', 'Campania', 'Emilia-Romagna', 'Friuli-Venezia Giulia',
    'Lazio', 'Liguria', 'Lombardia', 'Marche', 'Molise', 'Piemonte', 'Puglia',
    'Sardegna', 'Sicilia', 'Toscana', 'Trentino-Alto Adige', 'Umbria', 'Valle d\'Aosta',
    'Veneto'
  ],
  
  // Spain
  ES: [
    'Andalucía', 'Aragón', 'Asturias', 'Baleares', 'Canarias', 'Cantabria',
    'Castilla-La Mancha', 'Castilla y León', 'Cataluña', 'Ceuta', 'Comunidad Valenciana',
    'Extremadura', 'Galicia', 'La Rioja', 'Madrid', 'Melilla', 'Murcia', 'Navarra',
    'País Vasco'
  ],
  
  // Japan
  JP: [
    'Hokkaido', 'Aomori', 'Iwate', 'Miyagi', 'Akita', 'Yamagata', 'Fukushima',
    'Ibaraki', 'Tochigi', 'Gunma', 'Saitama', 'Chiba', 'Tokyo', 'Kanagawa',
    'Niigata', 'Toyama', 'Ishikawa', 'Fukui', 'Yamanashi', 'Nagano', 'Gifu',
    'Shizuoka', 'Aichi', 'Mie', 'Shiga', 'Kyoto', 'Osaka', 'Hyogo', 'Nara',
    'Wakayama', 'Tottori', 'Shimane', 'Okayama', 'Hiroshima', 'Yamaguchi',
    'Tokushima', 'Kagawa', 'Ehime', 'Kochi', 'Fukuoka', 'Saga', 'Nagasaki',
    'Kumamoto', 'Oita', 'Miyazaki', 'Kagoshima', 'Okinawa'
  ],
  
  // South Africa
  ZA: [
    'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo',
    'Mpumalanga', 'Northern Cape', 'North West', 'Western Cape'
  ],
  
  // Nigeria
  NG: [
    'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
    'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu',
    'Federal Capital Territory', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano',
    'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger',
    'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba',
    'Yobe', 'Zamfara'
  ]
};

export const AddressFormModal: React.FC<AddressFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false
}) => {
  const [formData, setFormData] = useState<AddressData>({
    billingAddress: {
      firstName: '',
      lastName: '',
      address1: '',
      address2: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'IN'
    },
    gstin: ''
  });

  const [errors, setErrors] = useState<{[key: string]: string}>({});

  // Check if GSTIN should be enabled (only for India)
  const isGstinEnabled = formData.billingAddress.country === 'IN';

  const handleInputChange = (
    field: string,
    value: string
  ) => {
    setFormData(prev => {
      const newBillingAddress = {
        ...prev.billingAddress,
        [field]: value
      };
      
      // Clear state when country changes to ensure valid state-country combination
      if (field === 'country') {
        newBillingAddress.state = '';
      }
      
      return {
        ...prev,
        billingAddress: newBillingAddress
      };
    });
    
    // Clear error when user starts typing
    if (errors[`billingAddress.${field}`]) {
      setErrors(prev => ({
        ...prev,
        [`billingAddress.${field}`]: ''
      }));
    }
    
    // Clear state error when country changes
    if (field === 'country' && errors['billingAddress.state']) {
      setErrors(prev => ({
        ...prev,
        'billingAddress.state': ''
      }));
    }
  };

  const handleGstinChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      gstin: value
    }));
    
    if (errors.gstin) {
      setErrors(prev => ({
        ...prev,
        gstin: ''
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};
    
    // Validate billing address
    const billing = formData.billingAddress;
    if (!billing.firstName.trim()) newErrors['billingAddress.firstName'] = 'First name is required';
    if (!billing.lastName.trim()) newErrors['billingAddress.lastName'] = 'Last name is required';
    if (!billing.address1.trim()) newErrors['billingAddress.address1'] = 'Address is required';
    if (!billing.city.trim()) newErrors['billingAddress.city'] = 'City is required';
    if (!billing.state.trim()) newErrors['billingAddress.state'] = 'State is required';
    if (!billing.zipCode.trim()) newErrors['billingAddress.zipCode'] = 'ZIP code is required';
    if (!billing.country) newErrors['billingAddress.country'] = 'Country is required';
    
    // Validate GSTIN for Indian customers
    if (isGstinEnabled && formData.gstin) {
      const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstinRegex.test(formData.gstin)) {
        newErrors.gstin = 'Please enter a valid GSTIN';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    onSubmit(formData);
  };

  if (!isOpen) return null;

  const renderAddressSection = (
    title: string,
    addressData: AddressData['billingAddress']
  ) => (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        {title}
      </h3>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            First Name *
          </label>
          <input
            type="text"
            value={addressData.firstName}
            onChange={(e) => handleInputChange('firstName', e.target.value)}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
              errors['billingAddress.firstName'] ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors['billingAddress.firstName'] && (
            <p className="text-red-500 text-xs mt-1">{errors['billingAddress.firstName']}</p>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Last Name *
          </label>
          <input
            type="text"
            value={addressData.lastName}
            onChange={(e) => handleInputChange('lastName', e.target.value)}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
              errors['billingAddress.lastName'] ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors['billingAddress.lastName'] && (
            <p className="text-red-500 text-xs mt-1">{errors['billingAddress.lastName']}</p>
          )}
        </div>
      </div>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Address Line 1 *
        </label>
        <input
          type="text"
          value={addressData.address1}
          onChange={(e) => handleInputChange('address1', e.target.value)}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
            errors['billingAddress.address1'] ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {errors['billingAddress.address1'] && (
          <p className="text-red-500 text-xs mt-1">{errors['billingAddress.address1']}</p>
        )}
      </div>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Address Line 2 (Optional)
        </label>
        <input
          type="text"
          value={addressData.address2 || ''}
          onChange={(e) => handleInputChange('address2', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            City *
          </label>
          <input
            type="text"
            value={addressData.city}
            onChange={(e) => handleInputChange('city', e.target.value)}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
              errors['billingAddress.city'] ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors['billingAddress.city'] && (
            <p className="text-red-500 text-xs mt-1">{errors['billingAddress.city']}</p>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            ZIP/Postal Code *
          </label>
          <input
            type="text"
            value={addressData.zipCode}
            onChange={(e) => handleInputChange('zipCode', e.target.value)}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
              errors['billingAddress.zipCode'] ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors['billingAddress.zipCode'] && (
            <p className="text-red-500 text-xs mt-1">{errors['billingAddress.zipCode']}</p>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            State/Province *
          </label>
          {STATES_BY_COUNTRY[addressData.country] ? (
            <select
              value={addressData.state}
              onChange={(e) => handleInputChange('state', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                errors['billingAddress.state'] ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Select State/Province</option>
              {STATES_BY_COUNTRY[addressData.country].map(state => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={addressData.state}
              onChange={(e) => handleInputChange('state', e.target.value)}
              placeholder="Enter State/Province"
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                errors['billingAddress.state'] ? 'border-red-500' : 'border-gray-300'
              }`}
            />
          )}
          {errors['billingAddress.state'] && (
            <p className="text-red-500 text-xs mt-1">{errors['billingAddress.state']}</p>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Country *
          </label>
          <select
            value={addressData.country}
            onChange={(e) => handleInputChange('country', e.target.value)}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
              errors['billingAddress.country'] ? 'border-red-500' : 'border-gray-300'
            }`}
          >
            {COUNTRIES.map(country => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </select>
          {errors['billingAddress.country'] && (
            <p className="text-red-500 text-xs mt-1">{errors['billingAddress.country']}</p>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Billing & Shipping Information
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            disabled={isLoading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <div className="flex-1 overflow-y-auto p-6">
            {/* Address Section */}
            {renderAddressSection('Billing & Shipping Address', formData.billingAddress)}

            {/* GSTIN Section */}
            {isGstinEnabled && (
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Tax Information (India)
                </h3>
                <div className="max-w-md">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    GSTIN (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.gstin || ''}
                    onChange={(e) => handleGstinChange(e.target.value.toUpperCase())}
                    placeholder="22AAAAA0000A1Z5"
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                      errors.gstin ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.gstin && (
                    <p className="text-red-500 text-xs mt-1">{errors.gstin}</p>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Enter your 15-digit GSTIN if you have one
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              {isLoading ? 'Processing...' : 'Continue to Checkout'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};