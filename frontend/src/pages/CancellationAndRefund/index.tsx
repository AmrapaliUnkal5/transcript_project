import { Box, styled, } from '@mui/material';
import React from 'react';

import HomeHeader from '../../components/Header/Header';
import Footer from '../../components/Footer/Footer';
import { CancellationRefundPolicy } from './CancellationRefundPolicy';



export default function CancellationAndRefund() {
    return (
        <Box fontFamily={"'Instrument Sans', sans-serif"}>
        <HomeHeader/>
        <CancellationRefundPolicy/>
        <Footer/> 
        </Box>
    );
}