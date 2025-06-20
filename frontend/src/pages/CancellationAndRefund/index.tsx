import { Box, styled, } from '@mui/material';
import React from 'react';

import HomeHeader from '../../components/Header/Header';
import Footer from '../../components/Footer/Footer';
import { CancellationRefundPolicy } from './CancellationRefundPolicy';
import PageBottom from '../TermsOfService/PageBottom';



export default function CancellationAndRefund() {
    return (
        <Box fontFamily={"'Instrument Sans', sans-serif"}>
        <HomeHeader/>
        <CancellationRefundPolicy/>
        <PageBottom/>
        <Footer/> 
        </Box>
    );
}