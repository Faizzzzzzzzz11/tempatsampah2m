import mqtt, { MqttClient } from 'mqtt';
import { CitizenReport } from '../types';

export const MQTT_CONFIG = {
  brokerUrl: 'wss://broker.emqx.io:8084/mqtt',
  clientId: 'trashroute_web_' + Math.random().toString(16).substring(2, 8),
  topics: {
    telemetry: 'trashroute_stem2026/telemetry',
    reports: 'trashroute_stem2026/reports',
    dispatch: 'trashroute_stem2026/dispatch',
    reportResolved: 'trashroute_stem2026/report_resolved',
  },
};

export class RealtimeSyncManager {
  private client: MqttClient | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private onReportReceived?: (report: CitizenReport) => void;
  private onTelemetryReceived?: (binId: number, fillPercent: number) => void;
  private onStatusChange?: (status: 'connected' | 'connecting' | 'fallback') => void;

  constructor(
    onReport?: (report: CitizenReport) => void,
    onTelemetry?: (binId: number, fillPercent: number) => void,
    onStatusChange?: (status: 'connected' | 'connecting' | 'fallback') => void
  ) {
    this.onReportReceived = onReport;
    this.onTelemetryReceived = onTelemetry;
    this.onStatusChange = onStatusChange;

    this.initBroadcastChannel();
    this.initLocalStorageListener();
    this.initMqtt();
  }

  private initBroadcastChannel() {
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.broadcastChannel = new BroadcastChannel('trashroute_sync_bus');
        this.broadcastChannel.onmessage = event => {
          if (event.data && event.data.topic) {
            this.handleMessage(event.data.topic, event.data.payload);
          }
        };
      } catch (e) {
        console.warn('BroadcastChannel error:', e);
      }
    }
  }

  private initLocalStorageListener() {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', e => {
        if (e.key === 'trashroute_client_event' && e.newValue) {
          try {
            const ev = JSON.parse(e.newValue);
            this.handleMessage(ev.topic, ev.payload);
          } catch (err) {
            console.error('Storage sync parse error:', err);
          }
        }
      });
    }
  }

  private initMqtt() {
    this.onStatusChange?.('connecting');
    try {
      this.client = mqtt.connect(MQTT_CONFIG.brokerUrl, {
        clientId: MQTT_CONFIG.clientId,
        clean: true,
        connectTimeout: 5000,
        reconnectPeriod: 6000,
      });

      this.client.on('connect', () => {
        this.onStatusChange?.('connected');
        this.client?.subscribe(MQTT_CONFIG.topics.telemetry);
        this.client?.subscribe(MQTT_CONFIG.topics.reports);
      });

      this.client.on('message', (topic, message) => {
        try {
          const payload = JSON.parse(message.toString());
          this.handleMessage(topic, payload);
        } catch (e) {
          console.warn('MQTT parse message error:', e);
        }
      });

      this.client.on('error', () => {
        this.onStatusChange?.('fallback');
      });

      this.client.on('offline', () => {
        this.onStatusChange?.('fallback');
      });
    } catch {
      this.onStatusChange?.('fallback');
    }
  }

  private handleMessage(topic: string, payload: any) {
    if (topic === MQTT_CONFIG.topics.reports) {
      if (this.onReportReceived && payload) {
        this.onReportReceived(payload);
      }
    } else if (topic === MQTT_CONFIG.topics.telemetry) {
      if (this.onTelemetryReceived && payload && payload.binId) {
        this.onTelemetryReceived(payload.binId, payload.fillPercent);
      }
    }
  }

  public publishReport(report: CitizenReport) {
    const payload = report;
    if (this.client?.connected) {
      this.client.publish(MQTT_CONFIG.topics.reports, JSON.stringify(payload));
    }
    this.broadcastChannel?.postMessage({
      topic: MQTT_CONFIG.topics.reports,
      payload,
    });
    try {
      localStorage.setItem(
        'trashroute_client_event',
        JSON.stringify({
          time: Date.now(),
          topic: MQTT_CONFIG.topics.reports,
          payload,
        })
      );
    } catch {}
  }

  public resolveReport(reportId: string, binId: number, binName: string) {
    const payload = {
      binId,
      reportId,
      status: 'resolved',
      message: `Sampah di ${binName} telah selesai diangkut oleh armada pengelola.`,
    };

    if (this.client?.connected) {
      this.client.publish(MQTT_CONFIG.topics.reportResolved, JSON.stringify(payload));
    }
    this.broadcastChannel?.postMessage({
      topic: MQTT_CONFIG.topics.reportResolved,
      payload,
    });
    try {
      localStorage.setItem(
        'trashroute_dashboard_event',
        JSON.stringify({
          time: Date.now(),
          topic: MQTT_CONFIG.topics.reportResolved,
          payload,
        })
      );
    } catch {}
  }

  public destroy() {
    this.client?.end();
    this.broadcastChannel?.close();
  }
}

export function playAlertChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.setValueAtTime(880.0, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch {}
}
