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


export default function MoreFaq() {
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
        py={5}
        sx={{ backgroundColor: '#101035' }}
      >
        <Container maxWidth='lg'>
          <Box
            px={[1, 10]}
            // py={[2, 13]}
            pt={[4,13]}
            pb={[2,10]}
           
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

          <Box mx={'auto'} maxWidth={769}>
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
                   How does website crawling work?
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant='body1' color='#D5D5D5'>
                  Our system automatically scans and indexes content from your specified websites, converting the information into a knowledge base that your AI bot can use to answer questions.
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
                  What is YouTube video grounding?
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant='body1' color='#D5D5D5'>
                  This feature allows your AI bot to extract and understand information from YouTube videos, enabling it to answer questions based on the video content.
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
                    How can I remove the "Powered by Evolra" branding?
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant='body1' color='#D5D5D5'>
                  You can remove our branding from the widget by purchasing the white-labeling add-on.


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
                     Can I customize the look of my bot?
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant='body1' color='#D5D5D5'>
                  Yes, all paid plans include full UI and branding customization options to match your brand’s identity.
                </Typography>
              </AccordionDetails>
            </Accordion>
 

<Accordion
              expanded={expanded === 'panel5'}
              onChange={handleChange('panel5')}
              sx={{
                borderRadius: '14px !important',
                background: expanded === 'panel5'
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
                    How many admin users can manage the bot?
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant='body1' color='#D5D5D5'>
                  The number of admin users varies by plan, ranging from 1 in the Starter Plan to unlimited in the Enterprise Plan. You can also purchase additional AI Admin user licenses based on your need.
                </Typography>
              </AccordionDetails>
            </Accordion>

          


            <Accordion
              expanded={expanded === 'panel7'}
              onChange={handleChange('panel7')}
              sx={{
                borderRadius: '14px !important',
                background: expanded === 'panel7'
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
                   How does the bot generate human-like conversations?

                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant='body1' color='#D5D5D5'>
                 Our platform uses advanced Large Language Models (LLMs) to generate intelligent, human-like responses. The bot continuously learns and adapts from user interactions, enhancing its conversational abilities over time
                </Typography>
              </AccordionDetails>
            </Accordion>


            <Accordion
              expanded={expanded === 'panel8'}
              onChange={handleChange('panel8')}
              sx={{
                borderRadius: '14px !important',
                background: expanded === 'panel8'
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
                     Can I customize the bot to match my brand?
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant='body1' color='#D5D5D5'>
                  Absolutely! You can personalize your bot’s appearance—such as colors, typography, and style—to perfectly align with your brand identity and deliver a seamless customer experience.


                </Typography>
              </AccordionDetails>
            </Accordion>


            <Accordion
              expanded={expanded === 'panel9'}
              onChange={handleChange('panel9')}
              sx={{
                borderRadius: '14px !important',
                background: expanded === 'panel9'
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
                    Does the platform provide analytics for the bot’s performance?
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant='body1' color='#D5D5D5'>
                  Yes, our Usage Analytics feature lets you track key metrics like user interactions, response accuracy, and engagement rates. These insights help you continuously optimize your bot’s performance.
                </Typography>
              </AccordionDetails>
            </Accordion>


            <Accordion
              expanded={expanded === 'pane20'}
              onChange={handleChange('pane20')}
              sx={{
                borderRadius: '14px !important',
                background: expanded === 'pane20'
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
                    What types of content can I use to train my bot?
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant='body1' color='#D5D5D5'>
                  You can train your bot using various content sources, including websites, PDFs, FAQs, Word documents, plain text files, and YouTube videos. This helps create a comprehensive knowledge base for accurate responses.


                </Typography>
              </AccordionDetails>
            </Accordion>


            <Accordion
              expanded={expanded === 'panel20'}
              onChange={handleChange('panel20')}
              sx={{
                borderRadius: '14px !important',
                background: expanded === 'panel20'
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
                     How do you count messages?
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant='body1' color='#D5D5D5'>
                 Messages are counted based on interactions with the chatbot.
                 Each user input and the corresponding AI response is
                 considered a single message unit for billing and usage
                 tracking purposes.
                </Typography>
              </AccordionDetails>
            </Accordion>


            <Accordion
              expanded={expanded === 'panel21'}
              onChange={handleChange('panel21')}
              sx={{
                borderRadius: '14px !important',
                background: expanded === 'panel21'
                  ? 'linear-gradient(0deg, #1D2051 0%, #3A419F 100%)'
                  : '#0F0A2D',
                marginBottom: '16px',
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon sx={{ color: '#FFF' }} />}
                aria-controls='panel21-content'
                id='panel21-header'
              >
                <Typography component='span' fontWeight={600}>
                  What happens when I cancel my subscription?
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant='body1' color='#D5D5D5'>
                  Your subscription is set to non-renewing immediately and stays active until the end of your current billing cycle. No immediate refunds or charges are made. Access continues until the term ends.
                </Typography>
              </AccordionDetails>
            </Accordion>

            <Accordion
              expanded={expanded === 'panel22'}
              onChange={handleChange('panel22')}
              sx={{
                borderRadius: '14px !important',
                background: expanded === 'panel22'
                  ? 'linear-gradient(0deg, #1D2051 0%, #3A419F 100%)'
                  : '#0F0A2D',
                marginBottom: '16px',
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon sx={{ color: '#FFF' }} />}
                aria-controls='panel22-content'
                id='panel22-header'
              >
                <Typography component='span' fontWeight={600}>
                  Can I cancel a subscription effective immediately?
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant='body1' color='#D5D5D5'>
                  No. Cancellations are scheduled for end of term to avoid proration and surprise charges.
                </Typography>
              </AccordionDetails>
            </Accordion>

            <Accordion
              expanded={expanded === 'panel23'}
              onChange={handleChange('panel23')}
              sx={{
                borderRadius: '14px !important',
                background: expanded === 'panel23'
                  ? 'linear-gradient(0deg, #1D2051 0%, #3A419F 100%)'
                  : '#0F0A2D',
                marginBottom: '16px',
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon sx={{ color: '#FFF' }} />}
                aria-controls='panel23-content'
                id='panel23-header'
              >
                <Typography component='span' fontWeight={600}>
                  How do I cancel an add-on?
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant='body1' color='#D5D5D5'>
                  Go to My Account → Add-ons → Cancel for the add-on. We schedule removal at your next billing cycle. No immediate charges/refunds.
                </Typography>
              </AccordionDetails>
            </Accordion>

            <Accordion
              expanded={expanded === 'panel24'}
              onChange={handleChange('panel24')}
              sx={{
                borderRadius: '14px !important',
                background: expanded === 'panel24'
                  ? 'linear-gradient(0deg, #1D2051 0%, #3A419F 100%)'
                  : '#0F0A2D',
                marginBottom: '16px',
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon sx={{ color: '#FFF' }} />}
                aria-controls='panel24-content'
                id='panel24-header'
              >
                <Typography component='span' fontWeight={600}>
                  Will cancelling an add-on take me to a checkout page?
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant='body1' color='#D5D5D5'>
                  No. Cancelling an add-on schedules its removal; there’s no checkout flow.
                </Typography>
              </AccordionDetails>
            </Accordion>

            <Accordion
              expanded={expanded === 'panel25'}
              onChange={handleChange('panel25')}
              sx={{
                borderRadius: '14px !important',
                background: expanded === 'panel25'
                  ? 'linear-gradient(0deg, #1D2051 0%, #3A419F 100%)'
                  : '#0F0A2D',
                marginBottom: '16px',
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon sx={{ color: '#FFF' }} />}
                aria-controls='panel25-content'
                id='panel25-header'
              >
                <Typography component='span' fontWeight={600}>
                  When do cancellation changes take effect?
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant='body1' color='#D5D5D5'>
                  Subscription cancellation: at the end of the current billing cycle. Add-on cancellation: from the next billing cycle.
                </Typography>
              </AccordionDetails>
            </Accordion>

            <Accordion
              expanded={expanded === 'panel27'}
              onChange={handleChange('panel27')}
              sx={{
                borderRadius: '14px !important',
                background: expanded === 'panel27'
                  ? 'linear-gradient(0deg, #1D2051 0%, #3A419F 100%)'
                  : '#0F0A2D',
                marginBottom: '16px',
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon sx={{ color: '#FFF' }} />}
                aria-controls='panel27-content'
                id='panel27-header'
              >
                <Typography component='span' fontWeight={600}>
                  Why can’t I downgrade my plan?
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant='body1' color='#D5D5D5'>
                  We prevent downgrades when your current usage exceeds the target plan’s limits (including any add-ons that will still be active next cycle). Reduce usage or remove add-ons first, then try again.
                </Typography>
              </AccordionDetails>
            </Accordion>

            <Accordion
              expanded={expanded === 'panel28'}
              onChange={handleChange('panel28')}
              sx={{
                borderRadius: '14px !important',
                background: expanded === 'panel28'
                  ? 'linear-gradient(0deg, #1D2051 0%, #3A419F 100%)'
                  : '#0F0A2D',
                marginBottom: '16px',
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon sx={{ color: '#FFF' }} />}
                aria-controls='panel28-content'
                id='panel28-header'
              >
                <Typography component='span' fontWeight={600}>
                  What limits are checked before a downgrade?
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant='body1' color='#D5D5D5'>
                  Words, messages, storage, and number of bots. We compare your current usage to the target plan plus any add-ons that are set to auto-renew.
                </Typography>
              </AccordionDetails>
            </Accordion>

            <Accordion
              expanded={expanded === 'panel29'}
              onChange={handleChange('panel29')}
              sx={{
                borderRadius: '14px !important',
                background: expanded === 'panel29'
                  ? 'linear-gradient(0deg, #1D2051 0%, #3A419F 100%)'
                  : '#0F0A2D',
                marginBottom: '16px',
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon sx={{ color: '#FFF' }} />}
                aria-controls='panel29-content'
                id='panel29-header'
              >
                <Typography component='span' fontWeight={600}>
                  Do I get a warning before downgrading?
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant='body1' color='#D5D5D5'>
                  Yes. If eligible, you’ll see a confirmation dialog with Cancel and Proceed options. If not eligible, we show exactly which limits are exceeded.
                </Typography>
              </AccordionDetails>
            </Accordion>

            <Accordion
              expanded={expanded === 'panel30'}
              onChange={handleChange('panel30')}
              sx={{
                borderRadius: '14px !important',
                background: expanded === 'panel30'
                  ? 'linear-gradient(0deg, #1D2051 0%, #3A419F 100%)'
                  : '#0F0A2D',
                marginBottom: '16px',
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon sx={{ color: '#FFF' }} />}
                aria-controls='panel30-content'
                id='panel30-header'
              >
                <Typography component='span' fontWeight={600}>
                  How do I enable the External Knowledge feature?
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant='body1' color='#D5D5D5'>
                  It requires the “External Knowledge” add-on. If you have it, you can toggle it on/off in Bot Settings and during bot creation. If not, you’ll be prompted to purchase the add-on.
                </Typography>
              </AccordionDetails>
            </Accordion>

            <Accordion
              expanded={expanded === 'panel31'}
              onChange={handleChange('panel31')}
              sx={{
                borderRadius: '14px !important',
                background: expanded === 'panel31'
                  ? 'linear-gradient(0deg, #1D2051 0%, #3A419F 100%)'
                  : '#0F0A2D',
                marginBottom: '16px',
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon sx={{ color: '#FFF' }} />}
                aria-controls='panel31-content'
                id='panel31-header'
              >
                <Typography component='span' fontWeight={600}>
                  I purchased External Knowledge but the toggle is disabled. Why?
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant='body1' color='#D5D5D5'>
                  Make sure you’re signed in with the same account that owns the add-on. We prefetch your entitlement on page load; try refreshing if you just purchased.
                </Typography>
              </AccordionDetails>
            </Accordion>

            <Accordion
              expanded={expanded === 'panel32'}
              onChange={handleChange('panel32')}
              sx={{
                borderRadius: '14px !important',
                background: expanded === 'panel32'
                  ? 'linear-gradient(0deg, #1D2051 0%, #3A419F 100%)'
                  : '#0F0A2D',
                marginBottom: '16px',
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon sx={{ color: '#FFF' }} />}
                aria-controls='panel32-content'
                id='panel32-header'
              >
                <Typography component='span' fontWeight={600}>
                  Why does the Explorer plan show “Free”?
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant='body1' color='#D5D5D5'>
                  Explorer is our free plan; pricing shows as “Free” on the account page.
                </Typography>
              </AccordionDetails>
            </Accordion>

            <Accordion
              expanded={expanded === 'panel33'}
              onChange={handleChange('panel33')}
              sx={{
                borderRadius: '14px !important',
                background: expanded === 'panel33'
                  ? 'linear-gradient(0deg, #1D2051 0%, #3A419F 100%)'
                  : '#0F0A2D',
                marginBottom: '16px',
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon sx={{ color: '#FFF' }} />}
                aria-controls='panel33-content'
                id='panel33-header'
              >
                <Typography component='span' fontWeight={600}>
                  Why don’t I see a “Continue with Free Plan” button for Explorer?
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant='body1' color='#D5D5D5'>
                  If you’re on any active paid plan, the Explorer (Free) option is hidden. It’s shown only when you have no active plan and haven’t previously used Explorer—it's limited to one use per account.
                </Typography>
              </AccordionDetails>
            </Accordion>

            {/* <Accordion
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
                    How does website crawling work?
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant='body1' color='#D5D5D5'>
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                  Suspendisse malesuada lacus ex, sit amet blandit leo lobortis
                  eget.
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                  Suspendisse malesuada lacus ex, sit amet blandit leo lobortis
                  eget.
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
                    How does website crawling work?
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant='body1' color='#D5D5D5'>
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                  Suspendisse malesuada lacus ex, sit amet blandit leo lobortis
                  eget.
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                  Suspendisse malesuada lacus ex, sit amet blandit leo lobortis
                  eget.
                </Typography>
              </AccordionDetails>
            </Accordion> */}
            


          </Box>
          <Box display={'flex'} justifyContent={'center'} my={5}>
            {/* <Button
              variant='outlined'
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
            </Button> */}
          </Box>
        </Container>
      </Box>
    </>
  );
}
