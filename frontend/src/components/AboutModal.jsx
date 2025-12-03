import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  Text,
  VStack,
  HStack,
  Box,
  Heading,
  Badge,
  Link,
  Divider,
  List,
  ListItem,
  ListIcon,
} from '@chakra-ui/react';
import { FiPlus, FiEdit, FiTool, FiTrash2, FiExternalLink, FiGithub } from 'react-icons/fi';
import aboutData from '../about.json';

const SECTION_ICONS = {
  added: FiPlus,
  changed: FiEdit,
  fixed: FiTool,
  removed: FiTrash2,
};

const SECTION_COLORS = {
  added: 'green',
  changed: 'blue',
  fixed: 'orange',
  removed: 'red',
};

const SECTION_LABELS = {
  added: 'Added',
  changed: 'Changed',
  fixed: 'Fixed',
  removed: 'Removed',
};

export const AboutModal = ({ isOpen, onClose }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" scrollBehavior="inside">
      <ModalOverlay backdropFilter="blur(4px)" />
      <ModalContent bg="gray.800" maxH="90vh">
        <ModalHeader>
          <Heading size="lg">{aboutData.name}</Heading>
        </ModalHeader>
        <ModalCloseButton />

        <ModalBody>
          <VStack align="stretch" spacing={6}>
            {/* Project Description */}
            <Box>
              <Text color="gray.300" fontSize="md">
                {aboutData.description}
              </Text>
            </Box>

            <Divider borderColor="gray.600" />

            {/* Project Info */}
            <HStack spacing={4} wrap="wrap" justify="space-between">
              <HStack spacing={2}>
                <Link href={aboutData.repository} isExternal>
                  <HStack color="blue.400" _hover={{ color: 'blue.300' }}>
                    <FiGithub />
                    <Text fontSize="sm">GitHub</Text>
                    <FiExternalLink size={14} />
                  </HStack>
                </Link>
              </HStack>
              <Badge colorScheme="gray" fontSize="sm" px={2} py={1}>
                {aboutData.license}
              </Badge>
            </HStack>

            <Divider borderColor="gray.600" />

            {/* Changelog */}
            <Box>
              <Heading size="md" mb={4}>
                Recent Changes
              </Heading>

              <VStack align="stretch" spacing={6}>
                {aboutData.versions.map((version, idx) => (
                  <Box key={idx}>
                    <HStack mb={3}>
                      <Badge
                        colorScheme={version.version === 'Unreleased' ? 'yellow' : 'blue'}
                        fontSize="md"
                        px={3}
                        py={1}
                        textTransform="none"
                      >
                        {version.version}
                      </Badge>
                      {version.date && (
                        <Text fontSize="sm" color="gray.400">
                          {version.date}
                        </Text>
                      )}
                    </HStack>

                    <VStack align="stretch" spacing={3} pl={2}>
                      {Object.entries(version.changes).map(([section, items]) => {
                        if (!items || items.length === 0) return null;

                        const Icon = SECTION_ICONS[section];
                        const color = SECTION_COLORS[section];
                        const label = SECTION_LABELS[section];

                        return (
                          <Box key={section}>
                            <Text
                              fontSize="sm"
                              fontWeight="bold"
                              color={`${color}.400`}
                              mb={2}
                            >
                              {label}
                            </Text>
                            <List spacing={1}>
                              {items.map((item, itemIdx) => (
                                <ListItem
                                  key={itemIdx}
                                  fontSize="sm"
                                  color="gray.300"
                                  pl={2}
                                >
                                  <ListIcon as={Icon} color={`${color}.400`} />
                                  {item}
                                </ListItem>
                              ))}
                            </List>
                          </Box>
                        );
                      })}
                    </VStack>

                    {idx < aboutData.versions.length - 1 && (
                      <Divider mt={4} borderColor="gray.700" />
                    )}
                  </Box>
                ))}
              </VStack>
            </Box>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button colorScheme="blue" onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
