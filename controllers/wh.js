const {
  generateSlug,
} = require('random-word-slugs');
const UserStates = require('../db/models/Userstate');
const discounts = require('../db/models/Userstate');
const msgCtrl = require('./msg');

const storeAPIkey = 'a55e9f8e5d6feebd23752396acd80cc4';
const storePassword = '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';
const accessToken = '9d75b9d30a16f02bb9517f2aafd9bd48';
const storeMyShopify = 'banarasi-outfit.myshopify.com';

const apiVersion = '2021-04';
const priceRuleId = '950294741183';

const {
  retireveCollections,
  createCheckoutList,
  getProductsByCollectionHandle,
  retireveVariantsOfProduct,
} = require('./storefrontAPI');
const {
  shopifyDiscountCreate,
} = require('./discountRestAPI');
const {
  getAllOrders,
} = require('../getAllOrders');
// const UserDiscount = require('../db/models/UserDiscountModel');

// const discount = new UserDiscount({ phone: 'string', discountCode: 'string' });
// UserDiscount.create({ discountCode: 'string' }, (err, res) => {
//   if (err) return console.log(err);
//   return res;
// });

function handleMessage(req, res) {
  res.status(200).send('');

  const fromNumber = req.body.From || req.body.From;
  if (fromNumber === 'whatsapp:+14155238886') return;
  const msg = req.body.Body || req.body.Body;
  // eslint-disable-next-line no-console
  console.log('wh controller', fromNumber, msg, req.body);

  const errorHandler = (err) => {
    // eslint-disable-next-line no-console
    console.log(err);
    msgCtrl.sendMsg({
      fromNumber,
      msg: JSON.stringify(err),
    });
  };

  function createNewDialog() {
    UserStates
      .create({
        phone: fromNumber,
        last: 'main',
      })
      .then(() => {
        msgCtrl.sendMsg({
          fromNumber,
          msg: 'Hello! What do you want?\n1. Catalogue\n2. Customer Support\n3. Order Status',
        });
      }).catch(errorHandler);
  }

  function sendCatalog() {
    retireveCollections(storeMyShopify, accessToken).then((
      response,
    ) => {
      console.log('sendCatalog');
      const collections = `Select catalog:\n${
        response.collections.edges
          .map((val, idx) => `${idx + 1}. ${val.node.handle}`)
          .join('\n')}`;
      // eslint-disable-next-line no-console
      console.log(collections, fromNumber);
      msgCtrl.sendMsg({
        fromNumber,
        msg: collections,
      });
      UserStates.updateOne(
        {
          phone: fromNumber,
        },
        {
          $set: {
            last: 'catalog',
            catalogs: response.collections.edges,
          },
        }, errorHandler,
      );
    }).catch(errorHandler);
  }

  const getSupport = () => {
    msgCtrl.sendMsg({
      fromNumber,
      msg: 'Hi there! Welcome to Customer Support Service! Please describe your problem, we will be contact with you within 10 minutes.',
    });
    UserStates.updateOne(
      {
        phone: fromNumber,
      },
      {
        $set: {
          last: 'tracking',
        },
      },
    );
  };

  const getOrderStatus = () => {
    msgCtrl.sendMsg({
      fromNumber,
      msg: 'Type your tracking number OR email.',
    });
    UserStates.updateOne(
      {
        phone: fromNumber,
      },
      {
        $set: {
          last: 'tracking',
        },
      },
    );
  };

  function continueDialog(state) {
    console.log('continueDialog', msg);

    if (msg.toLowerCase() === 'main') {
      msgCtrl.sendMsg({
        fromNumber,
        msg: 'Hello! What do you want?\n1. Catalogue\n2. Customer Support\n3. Order Status',
      });
      UserStates.updateOne(
        {
          phone: fromNumber,
        },
        {
          $set: {
            last: 'main',
          },
        },
      ).exec();
      return;
    }

    if (state.last === 'main') {
      switch (msg) {
        case '1': {
          sendCatalog();
          break; }
        case '2': {
          getSupport();
          break; }
        case '3': {
          getOrderStatus();
          break; }
        default: {
          msgCtrl.sendMsg({
            fromNumber,
            msg: 'Please, send right command',
          });
          break;
        }
      }
    } else if (state.last === 'tracking') {
      if (/@/.test(msg)) {
        getAllOrders(storeMyShopify, apiVersion, storeAPIkey, storePassword)
          .then((response) => {
            const trackNumbers = response.data.orders
              .filter((ord) => ord.email === msg)
              .map((ord) => ord.fulfillments.tracking_nunmbers)
              .flat();
            const arr = Array.from(new Set(trackNumbers));
            const ordersListTxt = arr
              .map(
                (trackNum, idx) => `${idx + 1}. https://t.17track.net/en#nums=${trackNum}`,
              )
              .join('\n');
            if (!ordersListTxt) {
              msgCtrl.sendMsg({
                fromNumber,
                msg: 'There is no order with such email, please recheck your email.',
              });
              return;
            }
            const txt = `Orders for email '${msg}':\n${ordersListTxt}`;
            msgCtrl.sendMsg({
              fromNumber,
              msg: txt,
            });
          })
          .catch((err) => {
            // eslint-disable-next-line no-console
            console.log(err);
            msgCtrl.sendMsg({
              fromNumber,
              msg: 'error on creating tracking url',
            });
          });
      } else {
        const trackingUrl = `https://t.17track.net/en#nums=${msg}`;
        msgCtrl.sendMsg({
          fromNumber,
          msg: `Please open this link to track your order!\n${trackingUrl}`,
        });
      }
    } else if (state.last === 'catalog') {
      if (!state.catalogs[msg - 1]) {
        msgCtrl.sendMsg({
          fromNumber,
          msg: 'Please, send right command',
        });
        return;
      }
      const { handle } = state.catalogs[msg - 1].node;
      getProductsByCollectionHandle(storeMyShopify, accessToken, handle).then(
        (response) => {
          console.log(response.collectionByHandle.products.edges);
          const products = response.collectionByHandle.products.edges;
          let txt = products
            .map((pr, idx) => `${idx + 1}. ${pr.node.handle}`)
            .join('\n');
          txt = `Select Product:\n${txt}`;

          msgCtrl.sendMsg({
            fromNumber,
            msg: txt,
          });
          UserStates.updateOne(
            {
              phone: fromNumber,
            },
            {
              last: 'products',
              products,
              $set: {
                last: 'products',
                products,
              },
            },
          ).exec();
        },
      );
    } else if (state.last === 'products') {
      if (!state.products[msg - 1]) {
        msgCtrl.sendMsg({
          fromNumber,
          msg: 'Please, send right command',
        });
        return;
      }

      const productID = state.products[msg - 1].node.id;
      retireveVariantsOfProduct(storeMyShopify, accessToken, productID).then(
        (response) => {
          const variants = response.node.variants.edges;
          const variantsSize = variants.length;
          variants.forEach((item, indx) => {
            const { title } = item.node;
            const imgUrl = item.node.image.originalSrc;
            msgCtrl.sendMsg({
              fromNumber,
              msg: `${indx + 1}. ${title}`,
              mediaUrl: imgUrl,
            });
            if (indx === variantsSize - 1) {
              setTimeout(() => {
                let txt = variants
                  .map((v, idx) => `${idx + 1}. ${v.node.title}`)
                  .join('\n');
                txt = `Select variants:\n${txt}`;
                msgCtrl.sendMsg({
                  fromNumber,
                  msg: txt,
                });
                UserStates.updateOne(
                  {
                    phone: fromNumber,
                  },
                  {
                    $set: {
                      last: 'variants',
                      variants,
                    },
                  },
                ).exec();
              }, 3000);
            }
          });
        },
      );
    } else if (state.last === 'variants') {
      if (!state.variants[msg - 1]) {
        msgCtrl.sendMsg({
          fromNumber,
          msg: 'Please, send right command',
        });
        return;
      }
      const { id: variantID, title } = state.variants[msg - 1].node;
      const storedLineItems = state.storedLineItems || [];
      const existsVariant = storedLineItems.find(
        (x) => x.variantId === variantID,
      );
      if (existsVariant) existsVariant.quantity += 1;
      else {
        storedLineItems.push({
          variantId: variantID,
          quantity: 1,
          title,
        });
      }
      const txt = 'Your item is placed in cart.What do you want next ? \n1.Continue shopping.\n2.See my cart. \n3.Proceed to payment.';
      msgCtrl.sendMsg({
        fromNumber,
        msg: txt,
      });
      UserStates.updateOne(
        {
          phone: fromNumber,
        },
        {
          $set: {
            last: 'added-to-cart',
            storedLineItems,
          },
        },
      ).exec();
    } else if (state.last === 'added-to-cart') {
      switch (msg) {
        case '1':
          sendCatalog();
          break;
        case '2':
          {
            const storedLineItemsText = state.storedLineItems
              .filter((x) => x.title && x.quantity)
              .map(
                ({ title, quantity }, idx) => `${idx + 1}. ${title}: ${quantity}`,
              )
              .join('\n');
            const txt = `${storedLineItemsText}\n 1.Proceed to payment \n 2. Delete item \n 3.Back`;
            msgCtrl.sendMsg({
              fromNumber,
              msg: txt,
            });
            UserStates.updateOne(
              {
                phone: fromNumber,
              },
              {
                $set: {
                  last: 'cart',
                },
              },
              errorHandler,
            );
          }
          break;
        case '3': {
          createCheckoutList(
            storeMyShopify,
            accessToken,
            state.storedLineItems,
          )
            .then((createdCheckoutInfo) => {
              const txt = `Congratulations! \nYour order is almost created.\nPlease, open this url and finish him!\n ${
                createdCheckoutInfo.checkoutCreate.checkout.webUrl}`;
              msgCtrl.sendMsg({
                fromNumber,
                msg: txt,
              });
              UserStates.updateOne({
                phone: fromNumber,
              },
              {
                $set: {
                  last: 'completed',
                  storedLineItems: [],
                },
              },
              errorHandler);
            });

          break; }
        default: {
          msgCtrl.sendMsg({
            fromNumber,
            msg: 'Please,send right command',
          });
          break;
        }
      }
    } else if (state.last === 'cart') {
      switch (msg) {
        case '1': {
          createCheckoutList(
            storeMyShopify,
            accessToken,
            state.storedLineItems,
          )
            .then((createdCheckoutInfo) => {
              const txt = `Congratulations! \nYour order is almost created.\nPlease, open this url and finish him!\n ${
                createdCheckoutInfo.checkoutCreate.checkout.webUrl}`;
              msgCtrl.sendMsg({
                fromNumber,
                msg: txt,
              });
              UserStates.updateOne({
                phone: fromNumber,
              },
              {
                $set: {
                  last: 'completed',
                  storedLineItems: [],
                },
              },
              errorHandler);
            });

          break;
        }
<<<<<<< HEAD
        case '3': {
=======
        case '2': {
>>>>>>> a8eaf149042fb27acf50be2ccd479ec0d79ad0ff
          const storedLineItemsText = state.storedLineItems
          .filter((x) => x.title && x.quantity)
          .map(({ title, quantity }, idx) => `${idx + 1}. ${title}: ${quantity}`,).join('\n');
          const txt = `${storedLineItemsText}\n Select item that you are gonna delete`;
          msgCtrl.sendMsg({
            fromNumber,
            msg: txt,
          });
          UserStates.updateOne({
            phone: fromNumber,
          },
          {
            $set: {
              last: 'deleteItem',
            },
          },
          errorHandler,
          );
<<<<<<< HEAD
          break;
        }
        case '1': {
          sendCatalog();
=======
            break;
          }
        case '3': {
          const txt = 'Your item is placed in cart.What do you want next ? \n1.Continue shopping.\n2.See my cart. \n3.Proceed to payment.';
          msgCtrl.sendMsg({
            fromNumber,
            msg: txt,
          });
          UserStates.updateOne(
            {
              phone: fromNumber,
            },
            {
              $set: {
                last: 'added-to-cart',
              },
            },
          ).exec();
>>>>>>> a8eaf149042fb27acf50be2ccd479ec0d79ad0ff
          break;
        }
        default: {
          msgCtrl.sendMsg({
            fromNumber,
            msg: 'Please,send right command',
          });
          break;
        }
      }
<<<<<<< HEAD
    }else if (state.last === 'deleteItem') {
      if(msg-1 > -1){
        const newList = storedLineItems.splice(msg-1,1);
        UserStates.updateOne(
          {
            phone: fromNumber,
          },
          {
            $set: {
              last: 'deleteItem',
              storedLineItems: newList,
            },
          },
        ).exec();
    } else if (state.last === 'demoMain') {
      if (msg === '1') {
        const discountSlug = generateSlug();
        shopifyDiscountCreate(
          storeMyShopify,
          apiVersion,
          storeAPIkey,
          storePassword,
          priceRuleId,
          discountSlug,
        )
          .then((response) => {
            const { code } = response.data.discount_code;
            const discountedUrl = `http://${externalUrl}/discount/${code}`;

            UserDiscount
              .create({
                discountCode: discountSlug,
                phone: fromNumber,
              })
              .then(() => {
                msgCtrl.sendMsg({
                  fromNumber,
                  msg: `Here is your promocode(click this link): ${discountedUrl}`,
                });
              })
              .catch((err) => {
                // eslint-disable-next-line no-console
                console.log(err);
                msgCtrl.sendMsg({
                  fromNumber,
                  msg: 'error on creating discount',
                });
              });
          })
          .catch((err) => {
            // eslint-disable-next-line no-console
            console.log(err);
            msgCtrl.sendMsg({
              fromNumber,
              msg: 'error on creating discount',
            });
          });
      } else {
        msgCtrl.sendMsg({
          fromNumber,
          msg: 'Hello! What do you want?\n1. Catalogue\n2. Customer Support\n3. Order Status',
        });
=======
    } else if (state.last === 'deleteItem') {
      if(msg-1 > -1){
        const newList = storedLineItems.splice(msg-1,1);
>>>>>>> a8eaf149042fb27acf50be2ccd479ec0d79ad0ff
        UserStates.updateOne(
          {
            phone: fromNumber,
          },
          {
            $set: {
              last: 'deleteItem',
              storedLineItems: newList,
            },
          },
        ).exec();
      } else {
        // eslint-disable-next-line no-constant-condition
        console.log("state.last !== 'main'", state);
      }
      }
      else{
        msgCtrl.sendMsg({
          fromNumber,
          msg: 'Please,send right command',
        });
        return;
      }
      
  }

  if (msg.toLowerCase() === 'discount') {
    const discountSlug = generateSlug();
    shopifyDiscountCreate(
      storeMyShopify,
      apiVersion,
      storeAPIkey,
      storePassword,
      priceRuleId,
      discountSlug,
    )
      .then((response) => {
        const { code } = response.data.discount_code;
        const discountedUrl = `http://${storeMyShopify}/discount/${code}`;

        discounts
          .insertOne({
            discountCode: discountSlug,
            phone: fromNumber,
          })
          .then(() => {
            msgCtrl.sendMsg({
              fromNumber,
              msg: `Here is your promocode: ${discountedUrl}`,
            });
          })
          .catch((err) => {
            // eslint-disable-next-line no-console
            console.log(err);
            msgCtrl.sendMsg({
              fromNumber,
              msg: 'error on creating discount',
            });
          });
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.log(err);
        msgCtrl.sendMsg({
          fromNumber,
          msg: 'error on creating discount',
        });
      });

    return;
  }
  console.log('UserStates.findOne');
  UserStates
    .findOne({
      phone: fromNumber,
    },
    (err, result) => {
      if (err) {
        return console.log(err);
      }
      console.log('find one result=', result);
      if (!result) {
        createNewDialog();
      } else {
        continueDialog(result);
      }
      return result;
    });
}
module.exports = {
  handleMessage,
};