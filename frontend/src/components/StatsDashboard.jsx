import { useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Input,
  Button,
  Text,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  Progress,
  useToast,
  Spinner,
  Center,
  Link,
  Heading,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Code,
} from '@chakra-ui/react';
import { FiExternalLink, FiAlertCircle } from 'react-icons/fi';
import { useApi } from '../hooks/useApi';

export const StatsDashboard = () => {
  const { apiCall } = useApi();
  const [shortId, setShortId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [errorDetails, setErrorDetails] = useState(null);
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const fetchStats = async () => {
    if (!shortId.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a short ID',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setIsLoading(true);
    setStats(null);

    try {
      const response = await apiCall(`/stats/${shortId.trim()}`, {
        method: 'GET',
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Short link not found');
        } else if (response.status === 401 || response.status === 403) {
          throw new Error('Authentication failed. Please sign in again.');
        } else {
          throw new Error('Failed to fetch statistics');
        }
      }

      const data = await response.json();
      setStats(data);
    } catch (error) {
      const errorInfo = {
        message: error.message,
        timestamp: new Date().toISOString(),
        endpoint: `${API_ENDPOINT}/stats/${shortId.trim()}`,
        method: 'GET',
        stack: error.stack,
      };
      setErrorDetails(errorInfo);

      toast({
        title: 'Failed to fetch statistics',
        description: (
          <Box>
            <Text>{error.message}</Text>
            <Link
              color="black"
              textDecoration="underline"
              cursor="pointer"
              onClick={onOpen}
              mt={2}
              display="inline-block"
            >
              More...
            </Link>
          </Box>
        ),
        status: 'error',
        duration: 8000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const parseWeek = (weekString) => {
    const parts = weekString.split('-W');
    return {
      year: parts[0],
      week: parts[1],
    };
  };

  return (
    <>
    <Box
      bg="rgba(26, 32, 44, 0.6)"
      backdropFilter="blur(10px)"
      p={6}
      borderRadius="lg"
      boxShadow="2xl"
      borderWidth="1px"
      borderColor="whiteAlpha.200"
    >
      <VStack spacing={6} align="stretch">
        <Heading size="md">Statistics</Heading>

        <HStack>
          <Input
            placeholder="Enter short ID (e.g., abc123)"
            value={shortId}
            onChange={(e) => setShortId(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && fetchStats()}
            bg="gray.700"
            border="none"
            _focus={{ bg: 'gray.700', ring: 2, ringColor: 'blue.500' }}
          />
          <Button
            colorScheme="blue"
            onClick={fetchStats}
            isLoading={isLoading}
            minW="120px"
          >
            Fetch Stats
          </Button>
        </HStack>

        {isLoading && (
          <Center py={10}>
            <Spinner size="xl" color="blue.500" />
          </Center>
        )}

        {stats && !isLoading && (
          <VStack spacing={6} align="stretch">
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
              <Box bg="gray.700" p={4} borderRadius="md">
                <Stat>
                  <StatLabel color="gray.400">Total Clicks</StatLabel>
                  <StatNumber fontSize="3xl">{stats.total_hits || 0}</StatNumber>
                </Stat>
              </Box>

              <Box bg="gray.700" p={4} borderRadius="md">
                <Stat>
                  <StatLabel color="gray.400">Created At</StatLabel>
                  <StatNumber fontSize="sm">{formatDate(stats.created_at)}</StatNumber>
                </Stat>
              </Box>
            </SimpleGrid>

            <Box bg="gray.700" p={4} borderRadius="md">
              <Stat>
                <StatLabel color="gray.400" mb={2}>Short URL</StatLabel>
                <Link href={stats.short_url} isExternal color="blue.400" fontSize="md" wordBreak="break-all">
                  {stats.short_url} <FiExternalLink style={{ display: 'inline', marginLeft: '4px' }} />
                </Link>
              </Stat>
            </Box>

            <Box bg="gray.700" p={4} borderRadius="md">
              <Stat>
                <StatLabel color="gray.400" mb={2}>Long URL</StatLabel>
                <Text fontSize="sm" color="gray.300" wordBreak="break-all">
                  {stats.long_url || '-'}
                </Text>
              </Stat>
            </Box>

            {stats.weekly_stats && stats.weekly_stats.length > 0 ? (
              <Box>
                <Heading size="sm" mb={4}>Weekly Statistics</Heading>
                <TableContainer>
                  <Table variant="simple" size="sm">
                    <Thead>
                      <Tr>
                        <Th color="gray.400">Week</Th>
                        <Th color="gray.400">Year</Th>
                        <Th color="gray.400" isNumeric>Clicks</Th>
                        <Th color="gray.400">Distribution</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {stats.weekly_stats.map((stat) => {
                        const { year, week } = parseWeek(stat.week);
                        const totalClicks = stats.weekly_stats.reduce(
                          (sum, s) => sum + s.clicks,
                          0
                        );
                        const percentage =
                          totalClicks > 0
                            ? ((stat.clicks / totalClicks) * 100).toFixed(1)
                            : 0;

                        return (
                          <Tr key={stat.week}>
                            <Td>Week {week}</Td>
                            <Td>{year}</Td>
                            <Td isNumeric fontWeight="bold">
                              {stat.clicks.toLocaleString()}
                            </Td>
                            <Td>
                              <HStack spacing={2}>
                                <Text fontSize="sm" minW="45px">
                                  {percentage}%
                                </Text>
                                <Progress
                                  value={percentage}
                                  size="sm"
                                  colorScheme="blue"
                                  borderRadius="md"
                                  flex="1"
                                />
                              </HStack>
                            </Td>
                          </Tr>
                        );
                      })}
                    </Tbody>
                  </Table>
                </TableContainer>
              </Box>
            ) : (
              <Box p={4} bg="gray.700" borderRadius="md" textAlign="center">
                <Text color="gray.400">No weekly statistics available</Text>
              </Box>
            )}
          </VStack>
        )}
      </VStack>
    </Box>

    <Modal isOpen={isOpen} onClose={onClose} size="xl" isCentered>
      <ModalOverlay backdropFilter="blur(4px)" />
      <ModalContent bg="gray.800" borderColor="red.500" borderWidth="2px">
        <ModalHeader>
          <HStack>
            <FiAlertCircle color="red" />
            <Text>Error Details</Text>
          </HStack>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {errorDetails && (
            <VStack align="stretch" spacing={4}>
              <Box>
                <Text fontWeight="bold" mb={2} color="gray.400" fontSize="sm">
                  Error Message:
                </Text>
                <Code
                  colorScheme="red"
                  p={3}
                  borderRadius="md"
                  display="block"
                  whiteSpace="pre-wrap"
                  bg="red.900"
                  color="red.100"
                >
                  {errorDetails.message}
                </Code>
              </Box>

              <Box>
                <Text fontWeight="bold" mb={2} color="gray.400" fontSize="sm">
                  Endpoint:
                </Text>
                <Code p={3} borderRadius="md" display="block" bg="gray.700">
                  {errorDetails.method} {errorDetails.endpoint}
                </Code>
              </Box>

              <Box>
                <Text fontWeight="bold" mb={2} color="gray.400" fontSize="sm">
                  Timestamp:
                </Text>
                <Code p={3} borderRadius="md" display="block" bg="gray.700">
                  {new Date(errorDetails.timestamp).toLocaleString()}
                </Code>
              </Box>

              {errorDetails.stack && (
                <Box>
                  <Text fontWeight="bold" mb={2} color="gray.400" fontSize="sm">
                    Stack Trace:
                  </Text>
                  <Code
                    p={3}
                    borderRadius="md"
                    display="block"
                    whiteSpace="pre-wrap"
                    fontSize="xs"
                    bg="gray.700"
                    maxH="200px"
                    overflowY="auto"
                  >
                    {errorDetails.stack}
                  </Code>
                </Box>
              )}
            </VStack>
          )}
        </ModalBody>

        <ModalFooter>
          <Button colorScheme="blue" onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
    </>
  );
};
