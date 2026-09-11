import React, { useCallback, useContext, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { BikeContext } from '../context/BikeContext';
import {
  addCompletedWeek,
  addRandomRecords,
  clearGeneratedRecords,
  countGeneratedRecords,
  restoreOriginalRecords,
} from '../utils/testData';

const TEST_BATCHES = [1, 10, 50, 100];

export default function TestDataScreen() {
  const [generatedCount, setGeneratedCount] = useState(0);
  const [isBusy, setIsBusy] = useState(false);
  const { triggerRefresh, triggerNotificationRefresh } = useContext(BikeContext);

  const loadGeneratedCount = useCallback(async () => {
    try {
      setGeneratedCount(await countGeneratedRecords());
    } catch (error) {
      console.error('Error loading generated test records:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadGeneratedCount();
    }, [loadGeneratedCount])
  );

  const runTestAction = async (action, successMessage) => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      const count = await action();
      await loadGeneratedCount();
      triggerRefresh();
      triggerNotificationRefresh();
      Alert.alert('Teste concluído', successMessage(count));
    } catch (error) {
      console.error('Error running test data action:', error);
      Alert.alert('Erro', 'Não foi possível executar este teste.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleClear = () => {
    Alert.alert(
      'Limpar dados de teste?',
      'Somente exercícios gerados por esta aba serão removidos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpar',
          style: 'destructive',
          onPress: () => runTestAction(
            clearGeneratedRecords,
            (count) => `${count} exercício(s) de teste removido(s).`
          ),
        },
      ]
    );
  };

  const handleRestore = () => {
    Alert.alert(
      'Restaurar dados originais?',
      'Isso remove todos os dados gerados desde o primeiro teste.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Restaurar',
          style: 'destructive',
          onPress: () => runTestAction(
            restoreOriginalRecords,
            (restored) => restored ? 'Os dados originais foram restaurados.' : 'Nenhum backup foi encontrado.'
          ),
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Testes</Text>
        <Text style={styles.subtitle}>Gere dados para validar o comportamento do app.</Text>

        <View style={styles.warningCard}>
          <Ionicons name="flask-outline" size={24} color="#FCD34D" />
          <Text style={styles.warningText}>
            Esta aba existe apenas no ambiente de desenvolvimento e usa o mesmo armazenamento dos exercícios reais.
          </Text>
        </View>

        <View style={styles.statusCard}>
          <View>
            <Text style={styles.cardEyebrow}>DADOS GERADOS</Text>
            <Text style={styles.statusValue}>{generatedCount}</Text>
            <Text style={styles.statusLabel}>exercícios de teste ativos</Text>
          </View>
          {isBusy ? (
            <ActivityIndicator size="small" color="#38BDF8" />
          ) : (
            <Ionicons name="pulse-outline" size={34} color="#38BDF8" />
          )}
        </View>

        <Text style={styles.sectionTitle}>Adicionar exercícios aleatórios</Text>
        <Text style={styles.sectionDescription}>
          Os registros usam valores e datas variados para testar listas, gráficos e estatísticas.
        </Text>
        <View style={styles.batchGrid}>
          {TEST_BATCHES.map((count) => (
            <TouchableOpacity
              key={count}
              style={styles.batchButton}
              onPress={() => runTestAction(
                () => addRandomRecords(count),
                (added) => `${added} exercício(s) aleatório(s) adicionado(s).`
              )}
              disabled={isBusy}
            >
              <Text style={styles.batchValue}>+{count}</Text>
              <Text style={styles.batchLabel}>{count === 1 ? 'exercício' : 'exercícios'}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Cenários direcionados</Text>
        <TouchableOpacity
          style={[styles.actionButton, styles.weekButton]}
          onPress={() => runTestAction(
            addCompletedWeek,
            (added) => `${added} exercícios foram distribuídos na semana atual para completar as metas.`
          )}
          disabled={isBusy}
        >
          <Ionicons name="calendar-outline" size={24} color="#FFFFFF" />
          <View style={styles.actionCopy}>
            <Text style={styles.actionTitle}>Completar semana atual</Text>
            <Text style={styles.actionDescription}>Gera sessões suficientes para ultrapassar as metas semanais.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Limpeza</Text>
        <TouchableOpacity
          style={[styles.actionButton, styles.clearButton]}
          onPress={handleClear}
          disabled={isBusy}
        >
          <Ionicons name="trash-outline" size={24} color="#FCA5A5" />
          <View style={styles.actionCopy}>
            <Text style={styles.actionTitle}>Limpar dados de teste</Text>
            <Text style={styles.actionDescription}>Remove apenas os registros criados nesta aba.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.restoreButton]}
          onPress={handleRestore}
          disabled={isBusy}
        >
          <Ionicons name="refresh-outline" size={24} color="#93C5FD" />
          <View style={styles.actionCopy}>
            <Text style={styles.actionTitle}>Restaurar dados originais</Text>
            <Text style={styles.actionDescription}>Volta ao estado salvo antes dos testes.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  content: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 15,
    marginTop: 5,
    marginBottom: 22,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#3B2F14',
    borderWidth: 1,
    borderColor: '#69551D',
    marginBottom: 16,
  },
  warningText: {
    flex: 1,
    color: '#FDE68A',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderRadius: 18,
    backgroundColor: '#111C30',
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 26,
  },
  cardEyebrow: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  statusValue: {
    color: '#FFFFFF',
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '900',
    marginTop: 4,
  },
  statusLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 7,
  },
  sectionDescription: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 13,
  },
  batchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 26,
  },
  batchButton: {
    width: '48%',
    minHeight: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  batchValue: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },
  batchLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 74,
    paddingHorizontal: 15,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  weekButton: {
    backgroundColor: '#1D3557',
    borderColor: '#2F5C91',
    marginBottom: 25,
  },
  clearButton: {
    backgroundColor: '#3B1F2B',
    borderColor: '#6B3043',
  },
  restoreButton: {
    backgroundColor: '#172A46',
    borderColor: '#284D7D',
  },
  actionCopy: {
    flex: 1,
    marginHorizontal: 12,
  },
  actionTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  actionDescription: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 17,
  },
});
