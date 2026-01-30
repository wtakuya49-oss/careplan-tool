/**
 * ケアプラン作成支援ツール - メインアプリケーション
 * カテゴリ別AI生成機能付き
 */

// ========================================
// グローバル状態
// ========================================
let currentPatientId = null;
let currentCategoryId = 'meal';
let assessmentData = {};  // { categoryId: { checkedItems: [], detailText: '' } }
let generatedPlans = {};  // { categoryId: { needs, longTermGoal, shortTermGoal, serviceContent } }
let carePlanItems = [];   // 計画書に転記された項目

// ========================================
// 初期化
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    // イベントリスナー設定
    document.getElementById('settingsBtn').addEventListener('click', () => showScreen('settingsScreen'));
    document.getElementById('newAssessmentBtn').addEventListener('click', startNewAssessment);
    document.getElementById('patientListBtn').addEventListener('click', () => {
        loadPatientList();
        showScreen('patientListScreen');
    });
    document.getElementById('addPatientBtn').addEventListener('click', () => showScreen('patientEntryScreen'));
    document.getElementById('patientForm').addEventListener('submit', handlePatientSubmit);
    document.getElementById('settingsForm').addEventListener('submit', handleSettingsSubmit);
    document.getElementById('viewCarePlanBtn').addEventListener('click', () => {
        transferGeneratedPlansToCarePlan();
        showScreen('carePlanScreen');
    });
    document.getElementById('addMoreBtn').addEventListener('click', () => showScreen('assessmentScreen'));
    document.getElementById('saveCarePlanBtn').addEventListener('click', saveCarePlan);

    // 設定読み込み
    loadSettings();

    // カテゴリタブ生成
    generateCategoryTabs();
}

// ========================================
// 画面遷移
// ========================================
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function confirmBackToHome() {
    if (Object.keys(assessmentData).length > 0 || Object.keys(generatedPlans).length > 0) {
        if (confirm('入力内容が失われます。戻りますか？')) {
            showScreen('homeScreen');
        }
    } else {
        showScreen('homeScreen');
    }
}

// ========================================
// 利用者管理
// ========================================
function loadPatientList() {
    const patients = getPatients();
    const listEl = document.getElementById('patientList');

    if (patients.length === 0) {
        listEl.innerHTML = '<div class="empty-state">利用者が登録されていません<br>＋ボタンで登録してください</div>';
        return;
    }

    listEl.innerHTML = patients.map(p => `
        <div class="patient-item" onclick="selectPatient(${p.id})">
            <div class="patient-info">
                <h3>${p.name}</h3>
                <p>${p.age ? p.age + '歳' : ''} ${p.careLevel || ''}</p>
            </div>
            <span>→</span>
        </div>
    `).join('');
}

function handlePatientSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('patientName').value;
    const age = document.getElementById('patientAge').value;
    const careLevel = document.getElementById('careLevel').value;

    const patient = {
        id: Date.now(),
        name,
        age: age ? parseInt(age) : null,
        careLevel
    };

    savePatient(patient);
    document.getElementById('patientForm').reset();
    loadPatientList();
    showScreen('patientListScreen');
}

function selectPatient(id) {
    currentPatientId = id;
    carePlanItems = getCarePlanItems(id);

    if (carePlanItems.length > 0) {
        renderCarePlan();
        showScreen('carePlanScreen');
    } else {
        startNewAssessment();
    }
}

function startNewAssessment() {
    assessmentData = {};
    generatedPlans = {};
    currentCategoryId = 'meal';
    generateCategoryTabs();
    renderAssessmentContent();
    updateViewCarePlanButton();
    showScreen('assessmentScreen');
}

// ========================================
// アセスメント入力（カテゴリ別）
// ========================================
function generateCategoryTabs() {
    const tabsEl = document.getElementById('categoryTabs');
    tabsEl.innerHTML = CATEGORIES.map(cat => {
        const hasData = assessmentData[cat.id]?.checkedItems?.length > 0;
        const hasGenerated = generatedPlans[cat.id] != null;

        let statusIcon = '';
        if (hasGenerated) {
            statusIcon = '<span class="status-icon generated">✓</span>';
        } else if (hasData) {
            statusIcon = '<span class="status-icon has-data">●</span>';
        }

        return `
            <button class="tab-btn ${cat.id === currentCategoryId ? 'active' : ''}" 
                    onclick="switchCategory('${cat.id}')">
                ${cat.name}${statusIcon}
            </button>
        `;
    }).join('');
}

function switchCategory(categoryId) {
    // 現在のカテゴリのデータを保存
    saveCurrentCategoryData();

    currentCategoryId = categoryId;
    generateCategoryTabs();
    renderAssessmentContent();
}

function saveCurrentCategoryData() {
    const items = ASSESSMENT_ITEMS[currentCategoryId] || [];
    const checkedItems = [];

    items.forEach((item, index) => {
        const checkbox = document.getElementById(`item-${currentCategoryId}-${index}`);
        if (checkbox && checkbox.checked) {
            checkedItems.push(item);
        }
    });

    const detailText = document.getElementById('detailText')?.value || '';

    if (checkedItems.length > 0 || detailText) {
        assessmentData[currentCategoryId] = { checkedItems, detailText };
    } else {
        delete assessmentData[currentCategoryId];
    }

    generateCategoryTabs();
    updateViewCarePlanButton();
}

function renderAssessmentContent() {
    const contentEl = document.getElementById('assessmentContent');
    const items = ASSESSMENT_ITEMS[currentCategoryId] || [];
    const savedData = assessmentData[currentCategoryId] || { checkedItems: [], detailText: '' };
    const generatedPlan = generatedPlans[currentCategoryId];
    const categoryName = CATEGORIES.find(c => c.id === currentCategoryId)?.name || '';

    let generatedPlanHtml = '';
    if (generatedPlan) {
        generatedPlanHtml = `
            <div class="generated-plan-section">
                <div class="section-title">生成されたプラン（${categoryName}）</div>
                <div class="generated-plan-card">
                    <div class="plan-item">
                        <span class="plan-label">①ニーズ</span>
                        <span class="plan-value">${generatedPlan.needs}</span>
                    </div>
                    <div class="plan-item">
                        <span class="plan-label">②長期目標</span>
                        <span class="plan-value">${generatedPlan.longTermGoal}</span>
                    </div>
                    <div class="plan-item">
                        <span class="plan-label">③短期目標</span>
                        <span class="plan-value">${generatedPlan.shortTermGoal}</span>
                    </div>
                    <div class="plan-item">
                        <span class="plan-label">④サービス内容</span>
                        <span class="plan-value">${generatedPlan.serviceContent}</span>
                    </div>
                    <div class="plan-actions">
                        <button class="action-btn regenerate-btn" onclick="regenerateCategory('${currentCategoryId}')">🔄 再生成</button>
                        <button class="action-btn delete-btn" onclick="deleteGeneratedPlan('${currentCategoryId}')">🗑️ 削除</button>
                    </div>
                </div>
            </div>
        `;
    }

    contentEl.innerHTML = `
        ${generatedPlanHtml}
        
        <div class="section-title">問題点や解決すべき課題等（${categoryName}）</div>
        <p class="section-hint">該当する項目にチェックを入れてください</p>
        
        <div class="checkbox-list">
            ${items.map((item, index) => `
                <div class="checkbox-item">
                    <input type="checkbox" id="item-${currentCategoryId}-${index}"
                           ${savedData.checkedItems.includes(item) ? 'checked' : ''}
                           onchange="onCheckboxChange()">
                    <span class="number">${getCircledNumber(index + 1)}</span>
                    <span class="label">${item}</span>
                </div>
            `).join('')}
        </div>
        
        <div class="section-title" style="margin-top: 24px;">具体的内容/対応するケア項目</div>
        <p class="section-hint">チェックした項目について、詳細を記入してください</p>
        <textarea id="detailText" class="form-group" 
                  placeholder="例：目が見えないので食事のお皿の場所が分からない。歯が無いので食事を細かくしないと食べられない。"
                  onblur="saveCurrentCategoryData()"
        >${savedData.detailText}</textarea>
        
        <div class="category-generate-section">
            <button id="generateCategoryBtn" class="generate-category-btn" onclick="generateForCurrentCategory()" 
                    ${savedData.checkedItems.length === 0 ? 'disabled' : ''}>
                ${generatedPlan ? '🔄 再生成する' : '✨ この項目を生成する'}
            </button>
            <button id="generateAllBtn" class="generate-all-btn" onclick="generateFromAllCategories()">
                🌟 すべてから統合生成 <span id="checkedCategoryCount">(${getCheckedCategoryCount()}項目)</span>
            </button>
        </div>
    `;
}

// チェックボックス変更時の処理
function onCheckboxChange() {
    saveCurrentCategoryData();
    updateGenerateButton();
}

// 生成ボタンの有効/無効を更新
function updateGenerateButton() {
    const btn = document.getElementById('generateCategoryBtn');
    if (!btn) return;

    const items = ASSESSMENT_ITEMS[currentCategoryId] || [];
    let hasChecked = false;

    items.forEach((item, index) => {
        const checkbox = document.getElementById(`item-${currentCategoryId}-${index}`);
        if (checkbox && checkbox.checked) {
            hasChecked = true;
        }
    });

    btn.disabled = !hasChecked;
}

// チェック済みカテゴリの数を取得
function getCheckedCategoryCount() {
    let count = 0;
    CATEGORIES.forEach(cat => {
        const data = assessmentData[cat.id];
        if (data && data.checkedItems && data.checkedItems.length > 0) {
            count++;
        }
    });
    return count;
}

// ========================================
// カテゴリ別AI生成
// ========================================
async function generateForCurrentCategory() {
    saveCurrentCategoryData();

    const categoryData = assessmentData[currentCategoryId];
    if (!categoryData || categoryData.checkedItems.length === 0) {
        alert('少なくとも1つの課題項目にチェックを入れてください');
        return;
    }

    const apiKey = localStorage.getItem('geminiApiKey');
    if (!apiKey) {
        if (confirm('Gemini APIキーが設定されていません。設定画面を開きますか？')) {
            showScreen('settingsScreen');
        }
        return;
    }

    showCategoryLoading(true);

    try {
        const result = await callGeminiAPIForCategory(currentCategoryId, categoryData, apiKey);
        generatedPlans[currentCategoryId] = result;
        generateCategoryTabs();
        renderAssessmentContent();
        updateViewCarePlanButton();
    } catch (error) {
        alert('AI生成に失敗しました: ' + error.message);
    } finally {
        showCategoryLoading(false);
    }
}

async function regenerateCategory(categoryId) {
    currentCategoryId = categoryId;
    await generateForCurrentCategory();
}

function deleteGeneratedPlan(categoryId) {
    if (confirm('生成されたプランを削除しますか？')) {
        delete generatedPlans[categoryId];
        generateCategoryTabs();
        renderAssessmentContent();
        updateViewCarePlanButton();
    }
}

// ========================================
// 統合計画書生成
// ========================================
async function generateFromAllCategories() {
    saveCurrentCategoryData();

    // チェック済みカテゴリを収集
    const checkedCategories = [];
    CATEGORIES.forEach(cat => {
        const data = assessmentData[cat.id];
        if (data && data.checkedItems && data.checkedItems.length > 0) {
            checkedCategories.push({
                id: cat.id,
                name: cat.name,
                checkedItems: data.checkedItems,
                detailText: data.detailText || ''
            });
        }
    });

    if (checkedCategories.length === 0) {
        alert('少なくとも1つのカテゴリでチェックを入れてください');
        return;
    }

    if (checkedCategories.length === 1) {
        if (!confirm('1つのカテゴリのみチェックされています。\n統合生成ではなく「この項目を生成する」の使用をお勧めしますが、続けますか？')) {
            return;
        }
    }

    const apiKey = localStorage.getItem('geminiApiKey');
    if (!apiKey) {
        if (confirm('Gemini APIキーが設定されていません。設定画面を開きますか？')) {
            showScreen('settingsScreen');
        }
        return;
    }

    showCategoryLoading(true);

    try {
        const results = await callGeminiAPIForIntegrated(checkedCategories, apiKey);

        // 結果をcarePlanItemsに追加
        results.forEach(item => {
            carePlanItems.push(item);
        });

        // 計画書画面に遷移
        showScreen('carePlanScreen');
        renderCarePlan();

        alert(`${results.length}件の統合計画書を生成しました！`);
    } catch (error) {
        alert('統合生成に失敗しました: ' + error.message);
    } finally {
        showCategoryLoading(false);
    }
}

async function callGeminiAPIForIntegrated(categories, apiKey) {
    const prompt = buildIntegratedPrompt(categories);

    console.log('統合プロンプト:', prompt);

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 8192
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('APIエラー:', errorText);
            throw new Error('API呼び出しに失敗しました');
        }

        const result = await response.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

        return parseIntegratedResponse(text, categories);
    } catch (error) {
        console.error('統合生成エラー:', error);
        throw error;
    }
}

function buildIntegratedPrompt(categories) {
    let categoryInfo = categories.map((cat, index) => {
        return `【カテゴリ${index + 1}: ${cat.name}】
・課題項目: ${cat.checkedItems.join('、')}
${cat.detailText ? `・具体的内容: ${cat.detailText}` : ''}`;
    }).join('\n\n');

    return `あなたは介護施設のベテランケアマネジャーです。以下の複数カテゴリのアセスメント情報を統合的に分析し、施設サービス計画書（第2表）を作成してください。

【アセスメント情報】
${categoryInfo}

【作成のポイント】
1. すべてのカテゴリの情報を統合的に分析してください
2. 関連性のある課題は、共通のニーズ・長期目標でまとめてください
   - 例：排泄と基本動作が関連している場合は同じニーズにする
   - 関連がないものは別のニーズ・長期目標にする
3. ニーズと長期目標の組み合わせは自由に判断してください
   - 同じニーズで違う長期目標もOK
   - 違うニーズで同じ長期目標もOK
4. 各カテゴリごとに短期目標とサービス内容を設定してください
5. 長期目標・短期目標は55文字以内で「〜〜できる」で終わる文章にしてください

【出力形式】
以下のJSON配列形式で、カテゴリ数と同じ${categories.length}件のオブジェクトを返してください：
[
  {
    "categoryName": "カテゴリ名",
    "needs": "ニーズの文言（関連カテゴリは同じニーズにする）",
    "longTermGoal": "長期目標（55文字以内、〜〜できるで終わる）",
    "shortTermGoal": "短期目標（55文字以内、〜〜できるで終わる）",
    "serviceContent": "サービス内容"
  },
  ...
]`;
}

function parseIntegratedResponse(text, categories) {
    console.log('統合レスポンス:', text);

    try {
        // コードブロックを除去
        let cleanedText = text
            .replace(/```json\s*/gi, '')
            .replace(/```\s*/g, '')
            .trim();

        // JSON配列を抽出
        const jsonMatch = cleanedText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsed)) {
                return parsed.map(item => ({
                    categoryName: item.categoryName || '不明',
                    needs: item.needs || '',
                    longTermGoal: item.longTermGoal || '',
                    shortTermGoal: item.shortTermGoal || '',
                    serviceContent: item.serviceContent || ''
                }));
            }
        }

        // パース失敗時はフォールバック
        console.error('統合レスポンスのパースに失敗');
        return categories.map(cat => ({
            categoryName: cat.name,
            needs: '統合分析に基づくニーズ',
            longTermGoal: '適切なケアを受けて安心して生活できる',
            shortTermGoal: '日常生活の課題を改善できる',
            serviceContent: '個別のケアプランに基づくサービス提供'
        }));
    } catch (error) {
        console.error('パースエラー:', error);
        return categories.map(cat => ({
            categoryName: cat.name,
            needs: '統合分析に基づくニーズ',
            longTermGoal: '適切なケアを受けて安心して生活できる',
            shortTermGoal: '日常生活の課題を改善できる',
            serviceContent: '個別のケアプランに基づくサービス提供'
        }));
    }
}

async function callGeminiAPIForCategory(categoryId, categoryData, apiKey) {
    const category = CATEGORIES.find(c => c.id === categoryId);
    const prompt = buildCategoryPrompt(category.name, categoryData);

    console.log('APIキー (先頭5文字):', apiKey.substring(0, 5) + '...');
    console.log('リクエスト送信中 (カテゴリ:', category.name, ')...');

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 4096
                }
            })
        });

        console.log('レスポンスステータス:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('APIエラー詳細:', errorText);

            let errorMessage = 'API呼び出しに失敗しました';
            try {
                const errorJson = JSON.parse(errorText);
                if (errorJson.error?.message) {
                    errorMessage = errorJson.error.message;
                }
            } catch (e) {
                errorMessage = `ステータス ${response.status}: ${errorText.substring(0, 100)}`;
            }
            throw new Error(errorMessage);
        }

        const result = await response.json();
        console.log('API レスポンス:', result);
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

        return parseCategoryResponse(text, category.name);
    } catch (error) {
        console.error('Fetch エラー:', error);
        throw error;
    }
}

function buildCategoryPrompt(categoryName, categoryData) {
    return `あなたは介護施設のケアマネジャーです。以下のアセスメント情報に基づいて、施設サービス計画書（第2表）に記載する文言を提案してください。

【カテゴリ】${categoryName}
【課題項目】${categoryData.checkedItems.join('、')}
${categoryData.detailText ? `【具体的内容】${categoryData.detailText}` : ''}

以下の4項目を日本語で提案してください：
1. ニーズ（生活全般の解決すべき課題）
2. 長期目標（**必ず55文字以内**で、「〜〜できる」で終わる文章にすること）
3. 短期目標（**必ず55文字以内**で、「〜〜できる」で終わる文章にすること）
4. サービス内容

回答は以下のJSON形式で返してください：
{
  "needs": "ニーズの文言",
  "longTermGoal": "長期目標の文言（55文字以内、〜〜できるで終わる）",
  "shortTermGoal": "短期目標の文言（55文字以内、〜〜できるで終わる）",
  "serviceContent": "サービス内容の文言"
}`;
}

function parseCategoryResponse(text, categoryName) {
    console.log('=== AIレスポンス解析開始 ===');
    console.log('生テキスト:', text);

    if (!text || text.trim() === '') {
        console.error('レスポンスが空です');
        return getFallbackResponse(categoryName);
    }

    try {
        // バッククォートを除去（```json や ``` を取り除く）
        let cleanedText = text
            .replace(/```json\s*/gi, '')
            .replace(/```\s*/g, '')
            .trim();

        console.log('クリーニング後のテキスト:', cleanedText);

        // JSONオブジェクトを抽出
        let jsonMatch = cleanedText.match(/\{[\s\S]*\}/);

        // 閉じカッコがない場合（途中で切れている場合）、補完を試みる
        if (!jsonMatch && cleanedText.includes('{')) {
            console.log('閉じカッコがありません。補完を試みます...');
            const startIndex = cleanedText.indexOf('{');
            let jsonText = cleanedText.substring(startIndex) + '}';
            // 必要に応じてさらに補完
            const openBraces = (jsonText.match(/\{/g) || []).length;
            const closeBraces = (jsonText.match(/\}/g) || []).length;
            for (let i = closeBraces; i < openBraces; i++) {
                jsonText += '}';
            }
            // 末尾のカンマを除去
            jsonText = jsonText.replace(/,\s*\}/g, '}');
            // 途中で切れた文字列を閉じる
            jsonText = jsonText.replace(/"[^"]*$/g, '"');
            console.log('補完後JSON:', jsonText);
            try {
                const parsed = JSON.parse(jsonText);
                jsonMatch = [jsonText];
            } catch (e) {
                console.error('補完したJSONのパースに失敗:', e);
            }
        }

        if (jsonMatch) {
            console.log('抽出されたJSON:', jsonMatch[0]);
            const parsed = JSON.parse(jsonMatch[0]);
            console.log('パース成功:', parsed);

            const result = {
                categoryName,
                needs: parsed.needs || parsed['ニーズ'] || '（生成失敗）',
                longTermGoal: parsed.longTermGoal || parsed['長期目標'] || '（生成失敗）',
                shortTermGoal: parsed.shortTermGoal || parsed['短期目標'] || '（生成失敗）',
                serviceContent: parsed.serviceContent || parsed['サービス内容'] || '（生成失敗）'
            };
            console.log('最終結果:', result);
            return result;
        } else {
            console.error('JSONが見つかりません。クリーニング後テキスト:', cleanedText);
        }
    } catch (e) {
        console.error('JSONパースエラー:', e);
    }

    console.warn('フォールバック値を使用');
    return getFallbackResponse(categoryName);
}

function getFallbackResponse(categoryName) {
    return {
        categoryName,
        needs: '適切なケアを受けて安心して生活したい',
        longTermGoal: '健康状態を維持し安心して過ごせる',
        shortTermGoal: '必要なケアを受けられる',
        serviceContent: '状態観察、声かけ、介助'
    };
}

function updateViewCarePlanButton() {
    const btn = document.getElementById('viewCarePlanBtn');
    const count = Object.keys(generatedPlans).length;
    if (count > 0) {
        btn.classList.remove('hidden');
        btn.textContent = `計画書を表示（${count}項目）`;
    } else {
        btn.classList.add('hidden');
    }
}

function transferGeneratedPlansToCarePlan() {
    // 既存の項目をクリアするか確認
    if (carePlanItems.length > 0) {
        if (!confirm('既存の計画書項目に追加しますか？（「キャンセル」で上書き）')) {
            carePlanItems = [];
        }
    }

    // generatedPlansをcarePlanItemsに転記
    for (const [categoryId, plan] of Object.entries(generatedPlans)) {
        carePlanItems.push({
            categoryId,
            categoryName: plan.categoryName,
            needs: plan.needs,
            longTermGoal: plan.longTermGoal,
            shortTermGoal: plan.shortTermGoal,
            serviceContent: plan.serviceContent
        });
    }

    renderCarePlan();
}

// ========================================
// 計画書表示
// ========================================
function renderCarePlan() {
    const contentEl = document.getElementById('carePlanContent');

    if (carePlanItems.length === 0) {
        contentEl.innerHTML = '<div class="empty-state">項目がありません</div>';
        return;
    }

    contentEl.innerHTML = `
        <p class="edit-hint">💡 各セルをクリックすると編集・AI修正ができます</p>
        <table class="careplan-table">
            <thead>
                <tr>
                    <th style="width:30px">No.</th>
                    <th>カテゴリ</th>
                    <th>生活全般の解決すべき課題<br>（ニーズ）</th>
                    <th>長期目標</th>
                    <th>短期目標</th>
                    <th>サービス内容</th>
                    <th style="width:50px">操作</th>
                </tr>
            </thead>
            <tbody>
                ${carePlanItems.map((item, index) => `
                    <tr>
                        <td style="text-align:center">${index + 1}</td>
                        <td>${item.categoryName}</td>
                        <td class="editable-cell" onclick="openEditModal(${index}, 'needs')">${item.needs}</td>
                        <td class="editable-cell" onclick="openEditModal(${index}, 'longTermGoal')">${item.longTermGoal}</td>
                        <td class="editable-cell" onclick="openEditModal(${index}, 'shortTermGoal')">${item.shortTermGoal}</td>
                        <td class="editable-cell" onclick="openEditModal(${index}, 'serviceContent')">${item.serviceContent}</td>
                        <td style="text-align:center">
                            <button class="delete-row-btn" onclick="deleteCarePlanItem(${index})">🗑️</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        
        <!-- 編集モーダル -->
        <div id="editModal" class="modal hidden">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 id="editModalTitle">文言を編集</h3>
                    <button class="modal-close" onclick="closeEditModal()">×</button>
                </div>
                <div class="modal-body">
                    <label>現在の文言:</label>
                    <textarea id="editTextarea" rows="4"></textarea>
                    
                    <label style="margin-top: 16px;">AI修正指示（任意）:</label>
                    <div class="ai-instruction-buttons">
                        <button class="ai-btn" onclick="setInstruction('もっと簡潔に')">簡潔に</button>
                        <button class="ai-btn" onclick="setInstruction('もっと具体的に')">具体的に</button>
                        <button class="ai-btn" onclick="setInstruction('敬語を使って丁寧に')">丁寧に</button>
                        <button class="ai-btn" onclick="setInstruction('専門用語を減らして')">平易に</button>
                    </div>
                    <input type="text" id="aiInstruction" placeholder="例：もう少し簡潔に、具体的な数字を入れて...">
                    <button id="aiRefineBtn" class="secondary-btn" onclick="refineWithAI()">✨ AIで修正</button>
                </div>
                <div class="modal-footer">
                    <button class="secondary-btn" onclick="closeEditModal()">キャンセル</button>
                    <button class="primary-btn" onclick="saveEdit()">保存</button>
                </div>
            </div>
        </div>
    `;
}

// 編集中のセル情報
let editingIndex = null;
let editingField = null;

const FIELD_LABELS = {
    needs: 'ニーズ',
    longTermGoal: '長期目標',
    shortTermGoal: '短期目標',
    serviceContent: 'サービス内容'
};

function openEditModal(index, field) {
    editingIndex = index;
    editingField = field;

    const item = carePlanItems[index];
    const currentText = item[field];

    document.getElementById('editModalTitle').textContent = `${FIELD_LABELS[field]}を編集`;
    document.getElementById('editTextarea').value = currentText;
    document.getElementById('aiInstruction').value = '';
    document.getElementById('editModal').classList.remove('hidden');
}

function closeEditModal() {
    document.getElementById('editModal').classList.add('hidden');
    editingIndex = null;
    editingField = null;
}

function setInstruction(text) {
    document.getElementById('aiInstruction').value = text;
}

function saveEdit() {
    const newText = document.getElementById('editTextarea').value.trim();
    if (newText && editingIndex !== null && editingField) {
        carePlanItems[editingIndex][editingField] = newText;
        renderCarePlan();
    }
    closeEditModal();
}

async function refineWithAI() {
    const currentText = document.getElementById('editTextarea').value;
    const instruction = document.getElementById('aiInstruction').value || 'より良い表現に修正して';

    const apiKey = localStorage.getItem('geminiApiKey');
    if (!apiKey) {
        alert('APIキーが設定されていません');
        return;
    }

    const btn = document.getElementById('aiRefineBtn');
    btn.disabled = true;
    btn.textContent = '⏳ 修正中...';

    try {
        const prompt = `以下の介護計画書の文言を、指示に従って修正してください。

【現在の文言】
${currentText}

【修正指示】
${instruction}

【注意事項】
- 介護計画書に適した専門的かつ分かりやすい表現にしてください
- 修正後の文言のみを返してください（説明不要）`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 2048
                }
            })
        });

        if (!response.ok) {
            throw new Error('API呼び出しに失敗しました');
        }

        const result = await response.json();
        const refinedText = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

        if (refinedText) {
            document.getElementById('editTextarea').value = refinedText.trim();
        }
    } catch (error) {
        alert('AI修正に失敗しました: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = '✨ AIで修正';
    }
}

function deleteCarePlanItem(index) {
    if (confirm('この項目を削除しますか？')) {
        carePlanItems.splice(index, 1);
        renderCarePlan();
    }
}

function saveCarePlan() {
    if (currentPatientId) {
        saveCarePlanItems(currentPatientId, carePlanItems);
        alert(`計画書を保存しました（${carePlanItems.length}件）`);
    } else {
        alert('利用者が選択されていません。利用者一覧から利用者を選択してください。');
    }
}

// ========================================
// コピー・エクスポート機能
// ========================================
function copyAllToClipboard() {
    if (carePlanItems.length === 0) {
        alert('コピーする項目がありません');
        return;
    }

    let text = '【施設サービス計画書（第2表）】\n\n';

    carePlanItems.forEach((item, index) => {
        text += `■ ${index + 1}. ${item.categoryName}\n`;
        text += `【ニーズ】${item.needs}\n`;
        text += `【長期目標】${item.longTermGoal}\n`;
        text += `【短期目標】${item.shortTermGoal}\n`;
        text += `【サービス内容】${item.serviceContent}\n\n`;
    });

    navigator.clipboard.writeText(text).then(() => {
        alert('計画書をクリップボードにコピーしました！\nWordやメモ帳に貼り付けできます。');
    }).catch(err => {
        // フォールバック: テキストエリアを使用
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        alert('計画書をクリップボードにコピーしました！');
    });
}

function exportToCSV() {
    if (carePlanItems.length === 0) {
        alert('出力する項目がありません');
        return;
    }

    // BOM付きUTF-8でExcelでも文字化けしないように
    const BOM = '\uFEFF';

    // ヘッダー行
    let csv = 'No.,カテゴリ,ニーズ,長期目標,短期目標,サービス内容\n';

    // データ行
    carePlanItems.forEach((item, index) => {
        const row = [
            index + 1,
            escapeCSV(item.categoryName),
            escapeCSV(item.needs),
            escapeCSV(item.longTermGoal),
            escapeCSV(item.shortTermGoal),
            escapeCSV(item.serviceContent)
        ];
        csv += row.join(',') + '\n';
    });

    // ダウンロード
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ケアプラン_${new Date().toLocaleDateString('ja-JP').replace(/\//g, '-')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    alert('CSVファイルをダウンロードしました！\nExcelやスプレッドシートで開けます。');
}

function escapeCSV(str) {
    if (!str) return '';
    // カンマ、改行、ダブルクォートを含む場合はダブルクォートで囲む
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

// ========================================
// ローカルストレージ操作
// ========================================
function getPatients() {
    return JSON.parse(localStorage.getItem('patients') || '[]');
}

function savePatient(patient) {
    const patients = getPatients();
    patients.push(patient);
    localStorage.setItem('patients', JSON.stringify(patients));
}

function getCarePlanItems(patientId) {
    const key = `careplan_${patientId}`;
    return JSON.parse(localStorage.getItem(key) || '[]');
}

function saveCarePlanItems(patientId, items) {
    const key = `careplan_${patientId}`;
    localStorage.setItem(key, JSON.stringify(items));
}

function loadSettings() {
    const apiKey = localStorage.getItem('geminiApiKey');
    if (apiKey) {
        document.getElementById('apiKey').value = apiKey;
    }
}

function handleSettingsSubmit(e) {
    e.preventDefault();
    const apiKey = document.getElementById('apiKey').value;
    localStorage.setItem('geminiApiKey', apiKey);
    alert('設定を保存しました');
    showScreen('homeScreen');
}

// ========================================
// ユーティリティ
// ========================================
function showCategoryLoading(show) {
    document.getElementById('loading').classList.toggle('hidden', !show);
}
