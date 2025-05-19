import React from "react";
import { Box, Button, Typography } from "@mui/material";
import Typical from "react-typical";
import Divider from '@mui/material/Divider';

import { styled } from "@mui/material/styles";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from "@mui/material";
export const OurplanTable = () => {
  return (
    <Box
      sx={{
        backgroundPosition: "center",
        backgroundColor: "#101035",
      }}
    >
      <Box
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
      >
        <Box
          display={"flex"}
          flexDirection={"column"}
          justifyContent={"center"}
          alignItems={"center"}
          textAlign={"center"}
          color={"#fff"}
          
          py={5}
        >
          <>
            {/* For Desktop */}
            <Typography
              variant="h2"
              fontWeight={600}
              fontSize={["30px", "40px", "40px"]}
              maxWidth={["286px", "930px"]}
              lineHeight={["44px", "40px"]}
              sx={{
                mt: "106px",
                background: "-webkit-linear-gradient(#FFF, #959595)",
                backgroundClip: "text",
                textFillColor: "transparent",
              }}
              textAlign="center"
            >
              Compare all features and plans
            </Typography>
          </>
        </Box>
      </Box>
      <Box px={1} py={0.5}>

        <Box display={["none", "block"]}>
        <TableContainer
          // component={Paper}
          sx={{
            backgroundPosition: "center",
            backgroundColor: "#101035",
            borderBottom: "none",
            "& td, & th": {
              borderBottom: "none",
              color: "white", // Optional: keep text white for dark background
            },
          }}
        >
          <Table 
            sx={{
              
              "& td, & th": {
                textAlign: "center",
                verticalAlign: "middle",
                padding:"22px 16px" // vertically center text in cells
              },
            }}
          >
            <TableHead>
              <TableRow >
                <TableCell
                  sx={{
                    fontSize: "18px",
                    fontWeight: 600,
                    lineHeight: "32px",
                    color: "white",
                    
                  }}
                ></TableCell>
                <TableCell
                  sx={{
                    fontSize: "18px",
                    fontWeight: 600,
                    lineHeight: "32px",
                    color: "white",
                    
                  }}
                >
                  Free
                </TableCell>
                <TableCell
                  sx={{
                    fontSize: "18px",
                    fontWeight: 600,
                    lineHeight: "32px",
                    color: "white",
                  }}
                >
                  Starter
                </TableCell>
                <TableCell
                  sx={{
                    fontSize: "18px",
                    fontWeight: 600,
                    lineHeight: "32px",
                    color: "white",
                  }}
                >
                  Growth
                </TableCell>
                <TableCell
                  sx={{
                    fontSize: "18px",
                    fontWeight: 600,
                    lineHeight: "32px",
                    color: "white",
                  }}
                >
                  Professional
                </TableCell>
                <TableCell
                  sx={{
                    fontSize: "18px",
                    fontWeight: 600,
                    lineHeight: "32px",
                    color: "white",
                  }}
                >
                  Enterprise
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              <TableRow>
                <TableCell sx={{ fontSize: "20px", fontWeight: 600,pt:"60px" }}>
                  Features
                </TableCell>
                <TableCell>
                  <Box display="flex" justifyContent="center" my={0}>
                    <Button
                      variant="text"
                      sx={{
                        width: "137px",
                        height: "40px",
                        
                        gap: "6px",
                        backgroundColor: "transparent",

                        color: "inherit",
                        border: "1px solid", // 1px solid border
                        borderColor: "currentColor", // border color same as text color
                        borderRadius: "40px",
                      }}
                    >
                      Get started
                    </Button>
                  </Box>
                </TableCell>
                <TableCell>
                  <Box display="flex" justifyContent="center" my={0}>
                    <Button
                      variant="text"
                      sx={{
                        width: "137px",
                        height: "40px",

                        gap: "6px",
                        backgroundColor: "transparent",

                        color: "inherit",
                        border: "1px solid", // 1px solid border
                        borderColor: "currentColor", // border color same as text color
                        borderRadius: "40px",
                      }}
                    >
                      Get started
                    </Button>
                  </Box>
                </TableCell>
                <TableCell>
                  {" "}
                  <Box display="flex" justifyContent="center" my={0}>
                    <Button
                      variant="text"
                      sx={{
                        width: "137px",
                        height: "40px",

                        gap: "6px",
                        backgroundColor: "transparent",

                        color: "inherit",
                        border: "1px solid", // 1px solid border
                        borderColor: "currentColor", // border color same as text color
                        borderRadius: "40px",
                      }}
                    >
                      Get started
                    </Button>
                  </Box>
                </TableCell>
                <TableCell>
                  {" "}
                  <Box display="flex" justifyContent="center" my={0}>
                    <Button
                      variant="text"
                      sx={{
                        width: "137px",
                        height: "40px",

                        gap: "6px",
                        backgroundColor: "transparent",

                        color: "inherit",
                        border: "1px solid", // 1px solid border
                        borderColor: "currentColor", // border color same as text color
                        borderRadius: "40px",
                      }}
                    >
                      Get started
                    </Button>
                  </Box>
                </TableCell>
                <TableCell>
                  {" "}
                  <Box display="flex" justifyContent="center" my={0}>
                    <Button
                      variant="text"
                      sx={{
                        width: "137px",
                        height: "40px",

                        gap: "6px",
                        backgroundColor: "transparent",

                        color: "inherit",
                        border: "1px solid", // 1px solid border
                        borderColor: "currentColor", // border color same as text color
                        borderRadius: "40px",
                      }}
                    >
                      Get started
                    </Button>
                  </Box>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ fontSize: "16px", fontWeight: 400,    }}>
                  Price
                </TableCell>
                <TableCell sx={{ fontSize: "16px", fontWeight: 400,    }}>$0</TableCell>
                <TableCell sx={{ fontSize: "16px", fontWeight: 400,    }}>$14.99</TableCell>
                <TableCell sx={{ fontSize: "16px", fontWeight: 400,    }}>$24.99</TableCell>
                <TableCell sx={{ fontSize: "16px", fontWeight: 400,    }}>$54.99</TableCell>
                <TableCell sx={{ fontSize: "16px", fontWeight: 400,    }}>Custom price</TableCell>
              </TableRow>

              <TableRow>
                <TableCell sx={{ fontSize: "16px", fontWeight: 400 ,   }}>
                  Chatbots
                </TableCell>
                <TableCell sx={{ fontSize: "16px", fontWeight: 400 ,   }}>1</TableCell>
                <TableCell sx={{ fontSize: "16px", fontWeight: 400 ,   }}>1</TableCell>
                <TableCell sx={{ fontSize: "16px", fontWeight: 400 ,   }}>1</TableCell>
                <TableCell sx={{ fontSize: "16px", fontWeight: 400 ,   }}>1</TableCell>
                <TableCell sx={{ fontSize: "16px", fontWeight: 400 ,   }}>1</TableCell>
              </TableRow>

              <TableRow>
                <TableCell sx={{ fontSize: "16px", fontWeight: 400 ,   }}>
                  Word Count
                </TableCell>
                <TableCell sx={{ fontSize: "16px", fontWeight: 400 ,   }}>
                  50k
                </TableCell>
                <TableCell sx={{ fontSize: "16px", fontWeight: 400 ,   }}>
                  50k
                </TableCell>
                <TableCell sx={{ fontSize: "16px", fontWeight: 400 ,   }}>
                  50k
                </TableCell>
                <TableCell sx={{ fontSize: "16px", fontWeight: 400 ,   }}>
                  50k
                </TableCell>
                <TableCell sx={{ fontSize: "16px", fontWeight: 400 ,   }}>
                  50k
                </TableCell>
              </TableRow>

              <TableRow>
                <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                  Storage
                </TableCell>
                <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                  20 MB
                </TableCell>
                <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                  20 MB
                </TableCell>
                <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                  20 MB
                </TableCell>
                <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                  20 MB
                </TableCell>
                <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                  20 MB
                </TableCell>
              </TableRow>

              <TableRow>
                <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                  Website Crawling
                </TableCell>
                <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                  1 website
                </TableCell>
                <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                  1 website
                </TableCell>
                <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                  1 website
                </TableCell>
                <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                  1 website
                </TableCell>
                <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                  1 website
                </TableCell>
              </TableRow>

              <TableRow>
                <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                  YouTube Grounding
                </TableCell>
                <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                  <Box display="flex" justifyContent="center">
                    <StyledImage
                      src="/images/icons/icon-cancel.png" // Use a different icon if needed
                      sx={{ width: "24px", height: "24px", marginBottom: 0 }}
                    />
                  </Box>
                </TableCell>
                <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                  <Box display="flex" justifyContent="center">
                    <StyledImage
                      src="/images/icons/icon-check.png" // Use a different icon if needed
                      sx={{ width: "24px", height: "24px", marginBottom: 0 }}
                    />
                  </Box>
                </TableCell>
                <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                  <Box display="flex" justifyContent="center">
                    <StyledImage
                      src="/images/icons/icon-check.png" // Use a different icon if needed
                      sx={{ width: "24px", height: "24px", marginBottom: 0 }}
                    />
                  </Box>
                </TableCell>
                <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                  {" "}
                  <Box display="flex" justifyContent="center">
                    <StyledImage
                      src="/images/icons/icon-check.png" // Use a different icon if needed
                      sx={{ width: "24px", height: "24px", marginBottom: 0 }}
                    />
                  </Box>
                </TableCell>
                <TableCell sx={{ fontSize: "16px", fontWeight: 400 }}>
                  {" "}
                  <Box display="flex" justifyContent="center">
                    <StyledImage
                      src="/images/icons/icon-check.png" // Use a different icon if needed
                      sx={{ width: "24px", height: "24px", marginBottom: 0 }}
                    />
                  </Box>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
        </Box>
        <Box display={["block", "none"]}>
          <Box  textAlign="left"  py={2}>
      <Typography
  fontSize="20px"
  fontWeight={600}
  color="#959494"
 textAlign="left"
 marginLeft={2}

>
  Price
</Typography>



<TableContainer
  sx={{
    backgroundColor: "#101035",
    "& td, & th": {
      borderBottom: "none",
      
    },
  }}
>
  <Table
   
  >
    <TableHead>
      <TableRow sx={{
      "& td": {
        paddingBottom: "1px", // Half of the desired 10px gap
      },
    }}>
        <TableCell
          sx={{ fontSize: "12px", color:" #A0A0A0" }}
        >
         Free
        </TableCell>
        <TableCell
             sx={{ fontSize: "12px", fontWeight: 400, color:" #A0A0A0" }}
        >
          Starter
        </TableCell>
        <TableCell
             sx={{ fontSize: "12px", fontWeight: 400, color:" #A0A0A0" }}
        >
          Growth
        </TableCell>
      </TableRow>
    </TableHead>
    <TableBody sx={{
      "& td": {
        paddingTop: "0px", // The other half
      },
    }}>
      <TableRow>
        <TableCell sx={{ fontSize: "14px", fontWeight: 400,color:"white" }}>$0</TableCell>
        <TableCell sx={{ fontSize: "14px", fontWeight: 400,color:"white" }}>$14.99</TableCell>
        <TableCell sx={{ fontSize: "14px", fontWeight: 400,color:"white" }}>$24.99</TableCell>
      </TableRow>
      
    </TableBody>

    <TableHead>
      <TableRow sx={{
      "& td": {
        paddingBottom: "1px", // Half of the desired 10px gap
      },
    }}>
        <TableCell
          sx={{ fontSize: "12px", color:" #A0A0A0" }}
        >
        Professional
        </TableCell>
        <TableCell
             sx={{ fontSize: "12px", fontWeight: 400, color:" #A0A0A0" }}
        >
          Enterprise
        </TableCell>
        
      </TableRow>
    </TableHead>
    <TableBody sx={{
      "& td": {
        paddingTop: "0px", // The other half
      },
    }}>
      <TableRow>
        <TableCell sx={{ fontSize: "14px", fontWeight: 400,color:"white" }}>$54.99</TableCell>
        <TableCell sx={{ fontSize: "14px", fontWeight: 400,color:"white" }}>Custom pricing</TableCell>
       
      </TableRow>
      
    </TableBody>
  </Table>
  <Divider
  sx={{
    width: '90%',         // or '100%' if full width is preferred
    mx: 'auto',           // centers it horizontally
    mt:1.5,                // optional: margin top for spacing
    borderBottom: 1,
    borderColor: '#3D3D3D',
}}
/>
</TableContainer>

          </Box>
          <Box  textAlign="left"  py={2}>
      <Typography
  fontSize="20px"
  fontWeight={600}
  color="#959494"
 textAlign="left"
 marginLeft={2}

>
  Chatbots
</Typography>



<TableContainer
  sx={{
    backgroundColor: "#101035",
    "& td, & th": {
      borderBottom: "none",
      
    },
  }}
>
  <Table
   
  >
    <TableHead>
      <TableRow sx={{
      "& td": {
        paddingBottom: "1px", // Half of the desired 10px gap
      },
    }}>
        <TableCell
          sx={{ fontSize: "12px", color:" #A0A0A0" }}
        >
         Free
        </TableCell>
        <TableCell
             sx={{ fontSize: "12px", fontWeight: 400, color:" #A0A0A0" }}
        >
          Starter
        </TableCell>
        <TableCell
             sx={{ fontSize: "12px", fontWeight: 400, color:" #A0A0A0" }}
        >
          Growth
        </TableCell>
      </TableRow>
    </TableHead>
    <TableBody sx={{
      "& td": {
        paddingTop: "0px", // The other half
      },
    }}>
      <TableRow>
        <TableCell sx={{ fontSize: "14px", fontWeight: 400,color:"white" }}>1</TableCell>
        <TableCell sx={{ fontSize: "14px", fontWeight: 400,color:"white" }}>1</TableCell>
        <TableCell sx={{ fontSize: "14px", fontWeight: 400,color:"white" }}>2</TableCell>
      </TableRow>
      
    </TableBody>

    <TableHead>
      <TableRow sx={{
      "& td": {
        paddingBottom: "1px", // Half of the desired 10px gap
      },
    }}>
        <TableCell
          sx={{ fontSize: "12px", color:" #A0A0A0" }}
        >
        Professional
        </TableCell>
        <TableCell
             sx={{ fontSize: "12px", fontWeight: 400, color:" #A0A0A0" }}
        >
          Enterprise
        </TableCell>
        
      </TableRow>
    </TableHead>
    <TableBody sx={{
      "& td": {
        paddingTop: "0px", // The other half
      },
    }}>
      <TableRow>
        <TableCell sx={{ fontSize: "14px", fontWeight: 400,color:"white" }}>5</TableCell>
        <TableCell sx={{ fontSize: "14px", fontWeight: 400,color:"white" }}>Custom </TableCell>
       
      </TableRow>
      
    </TableBody>
  </Table>
  <Divider
  sx={{
    width: '90%',         // or '100%' if full width is preferred
    mx: 'auto',           // centers it horizontally
    mt:1.5,                // optional: margin top for spacing
    borderBottom: 1,
    borderColor: '#3D3D3D',
}}
/>
</TableContainer>

          </Box>

          <Box  textAlign="left"  py={2}>
      <Typography
  fontSize="20px"
  fontWeight={600}
  color="#959494"
 textAlign="left"
 marginLeft={2}

>
  YouTube grounding
</Typography>



<TableContainer
  sx={{
    backgroundColor: "#101035",
    "& td, & th": {
      borderBottom: "none",
      
    },
  }}
>
  <Table
   
  >
    <TableHead>
      <TableRow sx={{
      "& td": {
        paddingBottom: "1px", // Half of the desired 10px gap
      },
    }}>
        <TableCell
          sx={{ fontSize: "12px", color:" #A0A0A0" }}
        >
         Free
        </TableCell>
        <TableCell
             sx={{ fontSize: "12px", fontWeight: 400, color:" #A0A0A0" }}
        >
          Starter
        </TableCell>
        <TableCell
             sx={{ fontSize: "12px", fontWeight: 400, color:" #A0A0A0" }}
        >
          Growth
        </TableCell>
      </TableRow>
    </TableHead>
    <TableBody sx={{
      "& td": {
        paddingTop: "0px", // The other half
      },
    }}>
      <TableRow>
        <TableCell sx={{ fontSize: "14px", fontWeight: 400,color:"white" }}><Box display="flex" justifyContent="left">
                    <StyledImage
                      src="/images/icons/icon-cancel.png" // Use a different icon if needed
                      sx={{ width: "24px", height: "24px", marginBottom: 0 }}
                    />
                  </Box></TableCell>
        <TableCell sx={{ fontSize: "14px", fontWeight: 400,color:"white" }}><Box display="flex" justifyContent="left">
                    <StyledImage
                      src="/images/icons/icon-check.png" // Use a different icon if needed
                      sx={{ width: "24px", height: "24px", marginBottom: 0 }}
                    />
                  </Box></TableCell>
        <TableCell sx={{ fontSize: "14px", fontWeight: 400,color:"white" }}><Box display="flex" justifyContent="left">
                    <StyledImage
                      src="/images/icons/icon-check.png" // Use a different icon if needed
                      sx={{ width: "24px", height: "24px", marginBottom: 0 }}
                    />
                  </Box></TableCell>
      </TableRow>
      
    </TableBody>

    <TableHead>
      <TableRow sx={{
      "& td": {
        paddingBottom: "1px", // Half of the desired 10px gap
      },
    }}>
        <TableCell
          sx={{ fontSize: "12px", color:" #A0A0A0" }}
        >
        Professional
        </TableCell>
        <TableCell
             sx={{ fontSize: "12px", fontWeight: 400, color:" #A0A0A0" }}
        >
          Enterprise
        </TableCell>
        
      </TableRow>
    </TableHead>
    <TableBody sx={{
      "& td": {
        paddingTop: "0px", // The other half
      },
    }}>
      <TableRow>
        <TableCell sx={{ fontSize: "14px", fontWeight: 400,color:"white" }}><Box display="flex" justifyContent="left">
                    <StyledImage
                      src="/images/icons/icon-check.png" // Use a different icon if needed
                      sx={{ width: "24px", height: "24px", marginBottom: 0 }}
                    />
                  </Box></TableCell>
        <TableCell sx={{ fontSize: "14px", fontWeight: 400,color:"white" }}><Box display="flex" justifyContent="left">
                    <StyledImage
                      src="/images/icons/icon-check.png" // Use a different icon if needed
                      sx={{ width: "24px", height: "24px", marginBottom: 0 }}
                    />
                  </Box></TableCell>
       
      </TableRow>
      
    </TableBody>
  </Table>
  
</TableContainer>

          </Box>
        </Box>
      </Box>
    </Box>
  );
};
const StyledImage = styled("img")(() => ({
  maxWidth: "100%",
  maxHeight: "100%",
}));
