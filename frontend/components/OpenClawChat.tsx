'use client'

import { useState, useEffect, useRef } from 'react'

interface Message {
  role: 'user' | 'bot'
  content: string
  timestamp: Date
}

export function OpenClawChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  
  // Config state
  const [endpoint, setEndpoint] = useState('https://your-openclaw-endpoint.amazonaws.com')
  const [apiKey, setApiKey] = useState('')
  const [botName, setBotName] = useState('OpenClaw Bot')

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      // Simulate API call to OpenClaw
      // In a real implementation, this would be:
      /*
      const response = await fetch(`${endpoint}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({ message: input })
      })
      const data = await response.json()
      */
      
      // Placeholder response for demonstration
      setTimeout(() => {
        const botResponse: Message = {
          role: 'bot',
          content: `I am your OpenClaw bot. I received: "${input}". (Note: This is a placeholder, please configure your AWS endpoint in settings.)`,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, botResponse])
        setIsLoading(false)
      }, 1000)

    } catch (error) {
      console.error('OpenClaw Error:', error)
      const errorMessage: Message = {
        role: 'bot',
        content: 'Error connecting to OpenClaw. Please check your configuration.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-surface border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-surface-elevated">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan animate-pulse" />
          <h3 className="text-sm font-medium text-text-primary">{botName}</h3>
        </div>
        <button 
          onClick={() => setShowConfig(!showConfig)}
          className="text-xs text-text-muted hover:text-cyan transition-colors"
        >
          {showConfig ? 'Close Config' : 'Configure'}
        </button>
      </div>

      {/* Config Panel */}
      {showConfig && (
        <div className="p-4 border-b border-border bg-surface-elevated/50 space-y-3">
          <div>
            <label className="block text-[10px] text-text-muted uppercase mb-1">AWS Endpoint</label>
            <input 
              type="text" 
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              className="w-full px-2 py-1 bg-background border border-border rounded text-xs text-text-primary"
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="block text-[10px] text-text-muted uppercase mb-1">API Key</label>
            <input 
              type="password" 
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full px-2 py-1 bg-background border border-border rounded text-xs text-text-primary"
              placeholder="sk-..."
            />
          </div>
          <div>
            <label className="block text-[10px] text-text-muted uppercase mb-1">Bot Name</label>
            <input 
              type="text" 
              value={botName}
              onChange={(e) => setBotName(e.target.value)}
              className="w-full px-2 py-1 bg-background border border-border rounded text-xs text-text-primary"
            />
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px]">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-text-muted">
            <p className="text-xs italic">No messages yet. Say hello to OpenClaw!</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
              msg.role === 'user' 
                ? 'bg-cyan/10 border border-cyan/20 text-text-primary' 
                : 'bg-surface-elevated border border-border text-text-secondary'
            }`}>
              {msg.content}
              <div className="text-[10px] opacity-50 mt-1">
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-muted">
              Thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-border bg-surface-elevated/30">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Type a message..."
            className="flex-1 bg-background border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-cyan/50"
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !input.trim()}
            className="bg-cyan text-background px-4 py-2 rounded text-sm font-medium hover:bg-cyan/90 transition-colors disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
