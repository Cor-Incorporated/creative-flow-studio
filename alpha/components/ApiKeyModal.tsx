import React from 'react';

interface ApiKeyModalProps {
    onSelectKey: () => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ onSelectKey }) => {
    return (
        <div className="absolute inset-0 bg-gray-900 bg-opacity-80 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-8 shadow-2xl max-w-md text-center">
                <h2 className="text-2xl font-bold text-white mb-4">
                    ビデオ生成にはAPIキーが必要です
                </h2>
                <p className="text-gray-400 mb-6">
                    Veoのビデオ生成機能を使用するには、APIキーを選択する必要があります。Google AI
                    Studioからダイアログが開きます。
                </p>
                <p className="text-sm text-gray-500 mb-6">
                    この機能を使用すると料金が発生する場合があります。詳細については、{' '}
                    <a
                        href="https://ai.google.dev/gemini-api/docs/billing"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline"
                    >
                        課金に関するドキュメント
                    </a>
                    を参照してください。
                </p>
                <button
                    onClick={onSelectKey}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                >
                    APIキーを選択
                </button>
            </div>
        </div>
    );
};

export default ApiKeyModal;
