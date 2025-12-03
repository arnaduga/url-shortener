import {
  Box,
  Container,
  VStack,
  Center,
  Spinner,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Text,
  Button,
} from '@chakra-ui/react';
import { useAuth } from './hooks/useAuth';
import { Header } from './components/Header';
import { LoginButton } from './components/LoginButton';
import { UrlShortenerForm } from './components/UrlShortenerForm';
import { StatsDashboard } from './components/StatsDashboard';
import { Footer } from './components/Footer';
import { SmokeEffect } from './components/SmokeEffect';

function App() {
  const { currentUser, isLoading, authError, signIn, signOut } = useAuth();

  if (isLoading) {
    return (
      <Center h="100vh" bg="gray.900">
        <VStack spacing={4}>
          <Spinner size="xl" color="blue.500" thickness="4px" />
          <Text color="gray.400" fontSize="sm">
            Verifying access...
          </Text>
        </VStack>
      </Center>
    );
  }

  return (
    <Box
      minH="100vh"
      display="flex"
      flexDirection="column"
      bgGradient="linear(to-br, gray.900 0%, #1a2a4a 50%, gray.900 100%)"
      position="relative"
      _before={{
        content: '""',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        bgGradient: 'radial(circle at 25% 25%, rgba(66, 153, 225, 0.15) 0%, transparent 50%)',
        pointerEvents: 'none',
        zIndex: 0,
      }}
      _after={{
        content: '""',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        bgGradient: 'radial(circle at 75% 75%, rgba(159, 122, 234, 0.12) 0%, transparent 50%)',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      <SmokeEffect />
      <Header user={currentUser} onSignOut={signOut} />

      <Container
        maxW="800px"
        flex="1"
        position="relative"
        zIndex={1}
        py={{ base: 4, md: 8 }}
      >
        {authError ? (
          <VStack spacing={6} maxW="600px" w="full">
            <Alert
              status="error"
              variant="subtle"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              textAlign="center"
              borderRadius="lg"
              bg="rgba(254, 178, 178, 0.1)"
              backdropFilter="blur(10px)"
              borderWidth="1px"
              borderColor="red.500"
              p={8}
            >
              <AlertIcon boxSize="40px" mr={0} />
              <AlertTitle mt={4} mb={2} fontSize="2xl">
                Access Denied
              </AlertTitle>
              <AlertDescription maxWidth="sm">
                <VStack spacing={3}>
                  <Text>
                    Sorry <strong>{authError.name}</strong> ({authError.email}), you are not authorized to access this application.
                  </Text>
                  <Text fontSize="sm" color="gray.300">
                    Please contact the administrator to request access.
                  </Text>
                  <Button
                    mt={4}
                    colorScheme="red"
                    variant="outline"
                    onClick={signOut}
                  >
                    Try Another Account
                  </Button>
                </VStack>
              </AlertDescription>
            </Alert>
          </VStack>
        ) : !currentUser ? (
          <VStack spacing={6} position="relative" zIndex={10}>
            <Box textAlign="center">
              <Box
                fontSize={{ base: '4xl', md: '6xl' }}
                fontWeight="bold"
                bgGradient="linear(to-r, blue.400, purple.500)"
                bgClip="text"
                mb={4}
              >
                URL Shortener
              </Box>
              <Box fontSize="lg" color="gray.400" mb={8}>
                Create short links, the easy way, the custom way
              </Box>
            </Box>
            <LoginButton onClick={signIn} />
          </VStack>
        ) : (
          <Box w="full">
            <Tabs colorScheme="blue" variant="soft-rounded" size="lg">
              <TabList
                mb={8}
                bg="rgba(26, 32, 44, 0.4)"
                p={2}
                borderRadius="xl"
                backdropFilter="blur(10px)"
                borderWidth="1px"
                borderColor="whiteAlpha.200"
              >
                <Tab
                  flex={1}
                  _selected={{
                    bg: 'blue.500',
                    color: 'white',
                    shadow: 'lg'
                  }}
                  _hover={{ bg: 'whiteAlpha.200' }}
                  borderRadius="lg"
                  fontWeight="semibold"
                >
                  Create Link
                </Tab>
                <Tab
                  flex={1}
                  _selected={{
                    bg: 'blue.500',
                    color: 'white',
                    shadow: 'lg'
                  }}
                  _hover={{ bg: 'whiteAlpha.200' }}
                  borderRadius="lg"
                  fontWeight="semibold"
                >
                  Statistics
                </Tab>
              </TabList>

              <TabPanels>
                <TabPanel px={0}>
                  <UrlShortenerForm />
                </TabPanel>
                <TabPanel px={0}>
                  <StatsDashboard />
                </TabPanel>
              </TabPanels>
            </Tabs>
          </Box>
        )}
      </Container>

      <Footer />
    </Box>
  );
}

export default App;
