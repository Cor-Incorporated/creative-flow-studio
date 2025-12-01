#!/usr/bin/env node
/**
 * Adminユーザー作成スクリプト（Node.js版）
 * kotaro.uchiho@gmail.comをメール&PWでadmin登録
 * 
 * Usage: node scripts/create-admin-user-node.js
 */

const { PrismaClient } = require('@prisma/client');
const { hashPassword } = require('../lib/password');

const prisma = new PrismaClient();

const EMAIL = 'kotaro.uchiho@gmail.com';
const PASSWORD = 'test12345';
const ROLE = 'ADMIN';

async function main() {
    console.log('🔍 ユーザーの存在を確認しています...');
    
    const existingUser = await prisma.user.findUnique({
        where: { email: EMAIL },
    });

    if (existingUser) {
        console.log('⚠️  ユーザーが既に存在します。更新します...');
        
        const hashedPassword = await hashPassword(PASSWORD);
        
        const updatedUser = await prisma.user.update({
            where: { email: EMAIL },
            data: {
                password: hashedPassword,
                role: ROLE,
            },
        });
        
        console.log('✅ ユーザーを更新しました:');
        console.log(`   ID: ${updatedUser.id}`);
        console.log(`   メール: ${updatedUser.email}`);
        console.log(`   名前: ${updatedUser.name || 'N/A'}`);
        console.log(`   ロール: ${updatedUser.role}`);
    } else {
        console.log('📝 新規ユーザーを作成します...');
        
        const hashedPassword = await hashPassword(PASSWORD);
        
        const newUser = await prisma.user.create({
            data: {
                email: EMAIL,
                password: hashedPassword,
                name: 'Kotaro Uchiho',
                role: ROLE,
            },
        });
        
        // デフォルトのFREEプランサブスクリプションを作成
        try {
            const { createDefaultFreeSubscription } = require('../lib/subscription');
            await createDefaultFreeSubscription(newUser.id);
            console.log('✅ デフォルトサブスクリプションを作成しました');
        } catch (error) {
            console.warn('⚠️  サブスクリプションの作成に失敗しました（続行します）:', error.message);
        }
        
        console.log('✅ ユーザーを作成しました:');
        console.log(`   ID: ${newUser.id}`);
        console.log(`   メール: ${newUser.email}`);
        console.log(`   名前: ${newUser.name}`);
        console.log(`   ロール: ${newUser.role}`);
    }
    
    console.log('');
    console.log('📧 ログイン情報:');
    console.log(`   メールアドレス: ${EMAIL}`);
    console.log(`   パスワード: ${PASSWORD}`);
    console.log(`   ロール: ${ROLE}`);
}

main()
    .catch((e) => {
        console.error('❌ エラーが発生しました:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
