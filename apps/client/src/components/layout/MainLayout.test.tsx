import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MainLayout } from './MainLayout';

const connectToChannelMock = vi.fn();

vi.mock('@livekit/components-react', () => ({
  RoomAudioRenderer: () => <div data-testid="audio-renderer" />,
  RoomContext: { Provider: ({ children }: { children: React.ReactNode }) => <div>{children}</div> },
}));

vi.mock('./ServerRail', () => ({
  ServerRail: ({ onSelectServer }: { onSelectServer: (id: number | null) => void }) => (
    <button data-testid="select-server" onClick={() => onSelectServer(1)}>
      Select server
    </button>
  ),
}));

vi.mock('./ChannelSidebar', () => ({
  ChannelSidebar: ({ onSelectChannel }: { onSelectChannel: (channel: any) => void }) => (
    <div>
      <button
        data-testid="select-voice-channel"
        onClick={() => onSelectChannel({ id: 99, name: 'Voice Channel', type: 'voice' })}
      >
        Voice channel
      </button>
      <button
        data-testid="select-text-channel"
        onClick={() => onSelectChannel({ id: 2, name: 'Text Channel', type: 'text' })}
      >
        Text channel
      </button>
    </div>
  ),
}));

vi.mock('./MemberSidebar', () => ({
  MemberSidebar: () => <div data-testid="member-sidebar">Members</div>,
}));

vi.mock('../server/WebChannelView', () => ({
  WebChannelView: ({ channelName }: { channelName: string }) => <div>Web: {channelName}</div>,
}));

vi.mock('../dashboard/HomeOnboardingStage', () => ({
  HomeOnboardingStage: ({ onCreateServer, onJoinServer }: { onCreateServer: () => void; onJoinServer: () => void }) => (
    <div>
      <p data-testid="onboarding-stage">Welcome</p>
      <button onClick={onCreateServer}>Create</button>
      <button onClick={onJoinServer}>Join</button>
    </div>
  ),
}));

vi.mock('../../features/voice/ui', () => ({
  VoiceChannelView: ({ channelName }: { channelName: string }) => (
    <div data-testid="voice-channel-view">Connected to {channelName}</div>
  ),
  VoicePreJoin: ({ channel, onJoin }: { channel: { name: string }; onJoin: () => void }) => (
    <div data-testid="voice-pre-join">
      <span>Pre-join for {channel.name}</span>
      <button onClick={onJoin}>Join voice</button>
    </div>
  ),
}));

vi.mock('../modals/OnboardingModal', () => ({
  OnboardingModal: ({ onClose }: { onClose: () => void }) => (
    <button data-testid="onboarding-modal" onClick={onClose}>
      Onboarding modal
    </button>
  ),
}));

vi.mock('../modals/ServerSettingsModal', () => ({
  ServerSettingsModal: () => <div data-testid="server-settings" />,
}));

vi.mock('../modals/CreateServerModal', () => ({
  CreateServerModal: () => <div data-testid="create-server" />,
}));

vi.mock('../modals/JoinServerModal', () => ({
  JoinServerModal: () => <div data-testid="join-server" />,
}));

vi.mock('../../features/voice', () => ({
  useVoice: () => ({
    activeRoom: null,
    activeChannelId: null,
    activeChannelName: null,
    connectionState: 'disconnected',
    muted: true,
    connectToChannel: connectToChannelMock,
  }),
}));

describe('MainLayout', () => {
  beforeEach(() => {
    connectToChannelMock.mockClear();
    localStorage.clear();
  });

  it('shows onboarding content when no server is selected', () => {
    render(<MainLayout />);
    expect(screen.getByTestId('onboarding-stage')).toBeInTheDocument();
  });

  it('renders channel controls after selecting a server', () => {
    render(<MainLayout />);

    fireEvent.click(screen.getByTestId('select-server'));

    expect(screen.getByTestId('select-voice-channel')).toBeInTheDocument();
    expect(screen.getAllByTestId('member-sidebar').length).toBeGreaterThan(0);
  });

  it('surfaces voice pre-join flow for voice channels and triggers connection on join', () => {
    render(<MainLayout />);

    fireEvent.click(screen.getByTestId('select-server'));
    fireEvent.click(screen.getByTestId('select-voice-channel'));

    const preJoin = screen.getByTestId('voice-pre-join');
    expect(preJoin).toBeInTheDocument();

    fireEvent.click(screen.getByText('Join voice'));
    expect(connectToChannelMock).toHaveBeenCalledWith(99, 'Voice Channel');
  });

  it('shows placeholder content for text channels', () => {
    render(<MainLayout />);

    fireEvent.click(screen.getByTestId('select-server'));
    fireEvent.click(screen.getByTestId('select-text-channel'));

    expect(screen.getByText(/Textkanal ausgewählt/i)).toBeInTheDocument();
  });
});
