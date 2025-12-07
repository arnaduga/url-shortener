import { Box, Container, Text, HStack, VStack, Link, Tooltip, useBreakpointValue } from '@chakra-ui/react';
import { useState } from 'react';
import { AboutModal } from './AboutModal';
import aboutData from '../about.json';

export const Footer = () => {
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const isMobile = useBreakpointValue({ base: true, md: false });

  // Get the latest version from about.json
  const currentVersion = aboutData.versions?.[0]?.version;

  return (
    <>
      <Box
        as="footer"
        bg="rgba(26, 32, 44, 0.8)"
        backdropFilter="blur(10px)"
        borderTop="1px"
        borderColor="whiteAlpha.200"
        py={{ base: 4, md: 6 }}
        mt="auto"
      >
        <Container maxW="800px">
          {isMobile ? (
            // Compact mobile version - stacked
            <VStack spacing={2} fontSize="xs" color="gray.400">
              <HStack spacing={2}>
                <Text>© {new Date().getFullYear()}</Text>
                <Text>•</Text>
                <Link
                  color="gray.400"
                  _hover={{ color: 'blue.400', textDecoration: 'underline' }}
                  cursor="pointer"
                  onClick={() => setIsAboutOpen(true)}
                >
                  {currentVersion ? `About ${currentVersion}` : 'About'}
                </Link>
              </HStack>
              <HStack spacing={1}>
                <Text>Made with</Text>
                <Tooltip label="Fun!" hasArrow>
                  <Text fontSize="md" cursor="pointer">🎉</Text>
                </Tooltip>
                <Text>& Claude</Text>
              </HStack>
            </VStack>
          ) : (
            // Desktop version - single line
            <HStack justify="center" spacing={2} fontSize="sm" color="gray.400">
              <Text>© {new Date().getFullYear()}</Text>
              <Text>•</Text>
              <Text>URL Shortener</Text>
              <Text>•</Text>
              <Link
                color="gray.400"
                _hover={{ color: 'blue.400', textDecoration: 'underline' }}
                cursor="pointer"
                onClick={() => setIsAboutOpen(true)}
              >
                {currentVersion ? `About ${currentVersion}` : 'About'}
              </Link>
              <Text>•</Text>
              <Text>Made with</Text>
              <Tooltip label="Fun!" hasArrow>
                <Text fontSize="lg" cursor="pointer">🎉</Text>
              </Tooltip>
              <Text>using React & Chakra UI & Claude</Text>
            </HStack>
          )}
        </Container>
      </Box>

      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
    </>
  );
};
