import { Box, Button, Container, Typography, styled } from '@mui/material';
import React from 'react';
import Accordion from '@mui/material/Accordion';
import MuiAccordionSummary, {
  AccordionSummaryProps,
  accordionSummaryClasses,
} from '@mui/material/AccordionSummary';
import MuiAccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

const AccordionSummary = styled((props: AccordionSummaryProps) => (
  <MuiAccordionSummary
    expandIcon={<ExpandMoreIcon sx={{ fontSize: '0.9rem', color: '#FFF' }} />}
    {...props}
  />
))(({ theme }) => ({
  backgroundColor: 'transparent',
  color: '#FFF',
  border: '1px solid #2E2C73',
  borderRadius: '14px',
  minHeight: '65px',
  [`& .${accordionSummaryClasses.expandIconWrapper}.${accordionSummaryClasses.expanded}`]:
    {
    color: '#FFF',
    },

  [`& .${accordionSummaryClasses.expanded}`]: {
    color: '#FFF',
    },

  [`& .${accordionSummaryClasses.content}`]: {
    marginLeft: theme.spacing(1),
  },
  ...theme.applyStyles('dark', {
    backgroundColor: 'rgba(255, 255, 255, .05)',
  }),
}));

const AccordionDetails = styled(MuiAccordionDetails)(({ theme }) => ({
  padding:' 0 24px 24px',
  
}));


export default function FAQ() {
  const [expanded, setExpanded] = React.useState<string | false>('panel1');

  const handleChange =
    (panel: string) => (event: React.SyntheticEvent, newExpanded: boolean) => {
      setExpanded(newExpanded ? panel : false);
    };
  return (
    <>
      <Box
        display={'flex'}
        flexDirection={'column'}
        justifyContent={'center'}
        alignItems={'center'}
        gap={2}
        color={'#fff'}
        px={2}
        py={[4,5]}
        sx={{ backgroundColor: '#101035' }}
      >
        <Container maxWidth='lg'>
          <Box
            px={[1, 10]}
            py={[3, 10]}
            sx={{
              backgroundImage: 'url(/images/title-bg.png)',
              backgroundSize: 'contain',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }}
          >
            <Typography
              variant='h2'
              fontWeight={600}
              fontSize={['30px', '48px', '60px']}
              sx={{
                background: '-webkit-linear-gradient(#FFF, #959595)',
                backgroundClip: 'text',
                textFillColor: 'transparent',
              }}
              textAlign={'center'}
            >
              Frequently Asked Questions
            </Typography>
          </Box>

          <Box mx={'auto'} maxWidth={[328,645]}>
            <Accordion
              expanded={expanded === 'panel1'}
              onChange={handleChange('panel1')}
              sx={{
                borderRadius: '14px !important',
                background: expanded === 'panel1'
                  ? 'linear-gradient(0deg, #1D2051 0%, #3A419F 100%)'
                  : '#0F0A2D',
                marginBottom: '16px',
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon sx={{ color: '#FFF' }} />}
                aria-controls='panel1-content'
                id='panel1-header'
                sx={{ borderRadius: '14px' }}
              >
                <Typography component='span' fontWeight={600}>
                  Does the platform support multiple languages?
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant='body1' color='#D5D5D5'>
                         Yes, our platform offers multilingual support, allowing your bot to understand and respond in various languages. This feature is perfect for businesses with global audiences.

                </Typography>
              </AccordionDetails>
            </Accordion>
            <Accordion
              expanded={expanded === 'panel2'}
              onChange={handleChange('panel2')}
              sx={{
                borderRadius: '14px !important',
                background: expanded === 'panel2'
                  ? 'linear-gradient(0deg, #1D2051 0%, #3A419F 100%)'
                  : '#0F0A2D',
                marginBottom: '16px',
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon sx={{ color: '#FFF' }} />}
                aria-controls='panel2-content'
                id='panel2-header'
              >
                <Typography component='span' fontWeight={600}>
                   Can the bot retrieve information from YouTube videos?
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant='body1' color='#D5D5D5'>
                  Yes, our YouTube video insights feature allows the bot to extract valuable information from your uploaded YouTube videos, making it a powerful tool for businesses that rely on video content.
                </Typography>
              </AccordionDetails>
            </Accordion>
            <Accordion
              expanded={expanded === 'panel3'}
              onChange={handleChange('panel3')}
              sx={{
                borderRadius: '14px !important',
                background: expanded === 'panel3'
                  ? 'linear-gradient(0deg, #1D2051 0%, #3A419F 100%)'
                  : '#0F0A2D',
                marginBottom: '16px',
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon sx={{ color: '#FFF' }} />}
                aria-controls='panel3-content'
                id='panel2-header'
              >
                <Typography component='span' fontWeight={600}>
                How do I integrate the bot into my website?

                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant='body1' color='#D5D5D5'>
                 Integrating the bot into your website is simple. You can deploy the bot in minutes with a single code snippet, making it instantly accessible to your website visitors.
                </Typography>
              </AccordionDetails>
            </Accordion>
            <Accordion
              expanded={expanded === 'panel4'}
              onChange={handleChange('panel4')}
              sx={{
                borderRadius: '14px !important',
                background: expanded === 'panel4'
                  ? 'linear-gradient(0deg, #1D2051 0%, #3A419F 100%)'
                  : '#0F0A2D',
                marginBottom: '16px',
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon sx={{ color: '#FFF' }} />}
                aria-controls='panel4-content'
                id='panel2-header'
              >
                <Typography component='span' fontWeight={600}>
                       Can I request a custom solution for my organization?

                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant='body1' color='#D5D5D5'>
                  Yes, we offer tailored solutions for organizations with unique requirements or high-volume needs. Contact our sales team to discuss your specific goals, and we will work with you to develop a solution that fits your organization perfectly.
                </Typography>
              </AccordionDetails>
            </Accordion>
          </Box>
          <Box display={'flex'} justifyContent={'center'} my={5}>
            <Button
              variant='outlined'
              size='large'
              href='/faq-page'
              sx={{
                fontSize: '18px',
                fontWeight: 500,
                borderRadius: '40px',
                height: '59px',
                minWidth: '150px',
                textTransform: 'capitalize',
                borderColor: '#fff',
                color: '#fff',
              }}
            >
              More FAQs
            </Button>
          </Box>
        </Container>
      </Box>
    </>
  );
}
