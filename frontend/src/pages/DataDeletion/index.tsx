import { Box, styled, } from '@mui/material';
import React from 'react';

import HomeHeader from '../../components/Header/Header';
import Footer from '../../components/Footer/Footer';
import { DataDeletionPolicy } from './DataDeletionPolicy';
import PageBottom from '../TermsOfService/PageBottom';



export default function DataDeletion() {
    return (
        <Box fontFamily={"'Instrument Sans', sans-serif"}>
        <HomeHeader/>
        <DataDeletionPolicy/>
        <PageBottom/>
        <Footer/> 
        </Box>
    );
}