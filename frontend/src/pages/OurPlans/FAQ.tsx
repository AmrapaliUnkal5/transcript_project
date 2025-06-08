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
  //border: '1px solid red',
  borderRadius: '14px',
  minHeight: '65px',
  [`& .${accordionSummaryClasses.expandIconWrapper}.${accordionSummaryClasses.expanded}`]:
    {
      // transform: 'rotate(90deg)',
      color: '#FFF',
    },

  [`& .${accordionSummaryClasses.expanded}`]: {
    // transform: 'rotate(90deg)',
    color: '#FFF',
    //border: '1px solid red'
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
  //border: '1px solid red',
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
        py={8}
        sx={{ backgroundColor: '#101035' }}
      >
        <Container maxWidth='lg'>
          <Box
            px={[1, 10]}
            py={[2, 10]}
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

          <Box mx={'auto'} maxWidth={646}>
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
                  Can I change my plan after signing up?
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant='body1' color='#D5D5D5'>
                  You can upgrade or downgrade your subscription at any time, but downgrades are only allowed if your usage is within the target plan’s limits; otherwise, please contact us.
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
                  Are there any setup fees?

                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant='body1' color='#D5D5D5'>
                   No, there are no setup fees included with any of our plans.

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
           What payment methods do you accept?
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant='body1' color='#D5D5D5'>
                  We accept all major credit and debit cards.
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
          How many words can I include in my knowledge base?
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant='body1' color='#D5D5D5'>
                 Each plan includes a specific word limit for your knowledge base. If you need more, you can purchase additional word capacity as an add-on.

                </Typography>
              </AccordionDetails>
            </Accordion>
          </Box>
          <Box display={'flex'} justifyContent={'center'} my={5}>
            <Button
              variant='outlined'
              href='/faq-page'
              size='large'
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
