import gql from 'graphql-tag';

export const Offers = gql`
    subscription Offers {
  offers(orderBy: createdAt, orderDirection: desc) {
    id
    createdAt
    offerContract
    offerId
    tokenURI
    active
    seller
    currency
    price
    tokenContract
    tokenId
    buyer
  }
}
    `;