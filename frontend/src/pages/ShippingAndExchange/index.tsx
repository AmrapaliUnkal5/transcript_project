import { Box, styled, } from '@mui/material';
import React from 'react';
import HomeHeader from '../../components/Header/Header';
import Footer from '../../components/Footer/Footer';
import { ShippingExchange } from './Shipingexchange';




export default function ShippingAndExchange() {
    return (
        <Box>
        <HomeHeader/>
       <ShippingExchange/>
        <Footer/> 
        </Box>
    );
}