import { Box, styled, } from '@mui/material';
import React from 'react';
import HomeHeader from '../../components/Header/Header';
import Footer from '../../components/Footer/Footer';
import { PrivacyPolicy } from './PrivacyPolicy';
import PageBottom from '../TermsOfService/PageBottom';



export default function Privacy() {
    return (
        <Box fontFamily={"'Instrument Sans', sans-serif"}>
        <HomeHeader/>
        <PrivacyPolicy/>
        <PageBottom/>
        <Footer/> 
        </Box>
    );
}