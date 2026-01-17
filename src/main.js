/**
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
   // @TODO: Расчет выручки от операции
   const discount = 1 - (purchase.discount / 100);
   return purchase.sale_price * purchase.quantity * discount;
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
    // @TODO: Расчет бонуса от позиции в рейтинге
    let bonusPercentage;
    
    if (index === 0) {
        bonusPercentage = 0.15;
    } else if (index === 1 || index === 2) {
        bonusPercentage = 0.10;
    } else if (index === total - 1) {
        bonusPercentage = 0;
    } else {
        bonusPercentage = 0.05;
    }
    
    // Возвращаем абсолютное значение бонуса в рублях
    return seller.profit * bonusPercentage;
}

/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */
function analyzeSalesData(data, options) {
    // @TODO: Проверка входных данных
    if (!data
        || !Array.isArray(data.sellers)
        || !Array.isArray(data.products)
        || !Array.isArray(data.purchase_records)
        || data.sellers.length === 0
        || data.products.length === 0
        || data.purchase_records.length === 0
    ) {
        throw new Error('Некорректные входные данные');
    }

    // @TODO: Проверка наличия опций
    if (typeof options !== 'object' || options === null) {
        throw new Error('Некорректные опции');
    }
    // Деструктуризация опций с проверкой
    const { calculateRevenue, calculateBonus } = options;
    
    // Проверка, что необходимые функции определены
    if (!calculateRevenue || !calculateBonus) {
        throw new Error('Не хватает обязательных функций в опциях');
    }

    // @TODO: Подготовка промежуточных данных для сбора статистики
    const sellerStats = data.sellers.map(seller => ({
        id: seller.id,
        name: `${seller.first_name} ${seller.last_name}`,
        revenue: 0,
        profit: 0,
        sales_count: 0,
        top_products: new Map(),
        bonus: 0,
        products_sold: {}
    }));

    // @TODO: Индексация продавцов и товаров для быстрого доступа
    const sellerIndex = Object.fromEntries(
        sellerStats.map(sellerStat => [sellerStat.id, sellerStat])
    );
    const productIndex = Object.fromEntries(
        data.products.map(product => [product.sku, product])
    );

    // @TODO: Расчет выручки и прибыли для каждого продавца
    data.purchase_records.forEach(record => {
        const seller = sellerIndex[record.seller_id];
        
        // Проверяем, что продавец найден
        if (!seller) {
            console.warn(`Продавец с ID ${record.seller_id} не найден, чек ${record.id} будет пропущен`);
            return;
        }
        
        seller.sales_count += 1;
        
        seller.revenue += record.total_amount;
        
        // Расчёт прибыли для каждого товара
        record.items.forEach(item => {
            const product = productIndex[item.sku];
            
            // Проверяем, что товар найден
            if (!product) {
                console.warn(`Товар с SKU ${item.sku} не найден в чеке ${record.id}`);
                return;
            }
            
            // Посчитать себестоимость
            const cost = product.purchase_price * item.quantity;
            
            // Посчитать выручку с учётом скидки
            const purchaseData = {
                sale_price: item.sale_price,
                quantity: item.quantity,
                discount: item.discount
            };
            
            const revenue = calculateRevenue(purchaseData, product);
            
            // Посчитать прибыль
            const profit = revenue - cost;
            
            // Увеличить общую накопленную прибыль у продавца
            seller.profit += profit;
            
            // Учёт количества проданных товаров
            if (!seller.products_sold[item.sku]) {
                seller.products_sold[item.sku] = 0;
            }
            // По артикулу товара увеличить его проданное количество у продавца
            seller.products_sold[item.sku] += item.quantity;
            
            // Обновляем топ товаров
            const currentCount = seller.top_products.get(item.sku) || 0;
            seller.top_products.set(item.sku, currentCount + item.quantity);
        });
    });

    // @TODO: Сортировка продавцов по прибыли
    sellerStats.sort((a, b) => {
        // Сравниваем по прибыли
        if (b.profit !== a.profit) {
            return b.profit - a.profit; // Убывающий порядок
        }
        // Если прибыль одинаковая, сортируем по выручке (убывание)
        if (b.revenue !== a.revenue) {
            return b.revenue - a.revenue;
        }
        // Если и выручка одинаковая, сортируем по количеству продаж (убывание)
        if (b.sales_count !== a.sales_count) {
            return b.sales_count - a.sales_count;
        }
        // Если все показатели одинаковые, сортируем по имени (алфавитный порядок)
        return a.name.localeCompare(b.name);
    });

    // @TODO: Назначение премий на основе ранжирования
    sellerStats.forEach((seller, index) => {
        // Считаем бонус (функция calculateBonusByProfit уже возвращает бонус в рублях)
        seller.bonus = calculateBonus(index, sellerStats.length, seller);
        
        // Формируем топ-10 товаров
        const topProductsArray = Array.from(seller.top_products.entries())
            .map(([sku, quantity]) => ({
                sku,
                quantity,
                product_name: productIndex[sku]?.name || sku,
                category: productIndex[sku]?.category || 'Неизвестно'
            }))
            // Сортировка по количеству (убывание)
            .sort((a, b) => b.quantity - a.quantity)
            // Берем первые 10
            .slice(0, 10);
        
        // Сохраняем топ-10 товаров
        seller.top_products = topProductsArray;
    });

    // @TODO: Подготовка итоговой коллекции с нужными полями
    return sellerStats.map(seller => ({
        seller_id: seller.id,
        name: seller.name,
        revenue: +seller.revenue.toFixed(2),
        profit: +seller.profit.toFixed(2),
        sales_count: seller.sales_count,
        top_products: seller.top_products,
        bonus: +seller.bonus.toFixed(2)
    }));
}